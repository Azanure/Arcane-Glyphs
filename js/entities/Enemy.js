export class Enemy {
  constructor(
    scene,
    playerPos,
    radius,
    color = new BABYLON.Color3(1, 0, 0),
    customMesh = null,
    playerLevel = 1
  ) {
    this.scene = scene;
    this.baseHp = 100;
    this.baseSpeed = 0.035;
    this.baseDamage = 10;
    this.baseExp = 5;

    this.maxHp = this.baseHp;
    this.hp = this.maxHp;


    let baseSpeed = 0.035;
    this.speed = baseSpeed * (1 + (playerLevel - 1) * 0.01);

    let baseDamage = 10;
    this.damage = baseDamage + (playerLevel - 1) * 2;

    this.experienceValue = 5 + Math.floor(playerLevel / 2);
    this.lastDamageTime = 0;
    this.damageCooldown = 1500; // Un peu plus long car lié à l'animation
    this.attackRange = 1.8; // Distance pour lancer l'attaque
    this.isAttacking = false;
    this.animationGroups = [];
    this.isCustom = !!customMesh;

    if (customMesh) {
      this.mesh = customMesh;
    } else {
      this.mesh = BABYLON.MeshBuilder.CreateCapsule(
        "enemy",
        { height: 2, radius: 0.5 },
        scene,
      );
      const mat = new BABYLON.StandardMaterial("enemyMat", scene);
      mat.diffuseColor = color;
      this.mesh.material = mat;
    }

    // --- HITBOX ENNEMI ---
    this.hitbox = BABYLON.MeshBuilder.CreateCapsule(
      "enemyHitbox",
      { height: 2.0, radius: 0.5 },
      scene,
    );
    this.hitbox.parent = this.mesh;
    this.hitbox.position.y = 1;
    this.hitbox.isPickable = false;
    this.hitbox.isVisible = false; // Hitbox invisible (conservée pour les collisions de sort)

    const rng = window.rng;
    const angle = (rng ? rng.next() : Math.random()) * Math.PI * 2;
    this.mesh.position.x = playerPos.x + Math.cos(angle) * radius;
    this.mesh.position.z = playerPos.z + Math.sin(angle) * radius;
    this.mesh.position.y = customMesh ? 0 : 1;

    // Orientation initiale
    this.mesh.lookAt(
      new BABYLON.Vector3(playerPos.x, this.mesh.position.y, playerPos.z),
    );

    this.isDead = false;
    this.deathPosition = null;
    this.freezeEndTime = 0;
    this.slowEndTime = 0;
    this.isTornadoSucked = false;
    this.knockbackVelocity = new BABYLON.Vector3(0, 0, 0);

    // Initial setup
    this.respawn(playerPos, playerLevel);
  }

  respawn(playerPos, playerLevel) {
    this.maxHp = this.baseHp * Math.pow(1.15, playerLevel - 1);
    this.hp = this.maxHp;

    this.speed = this.baseSpeed * (1 + (playerLevel - 1) * 0.01);
    this.damage = this.baseDamage + (playerLevel - 1) * 2;
    this.experienceValue = this.baseExp + Math.floor(playerLevel / 2);

    this.isDead = false;
    this.deathPosition = null;
    this.freezeEndTime = 0;
    this.slowEndTime = 0;
    this.isTornadoSucked = false;
    this.knockbackVelocity.set(0, 0, 0);
    this.isAttacking = false;
    this.lastDamageTime = 0;

    if (playerPos) {
        this.mesh.position.x = playerPos.x;
        this.mesh.position.y = this.isCustom ? 0 : 1;
        this.mesh.position.z = playerPos.z;
    }
    this.mesh.setEnabled(true);
    
    // Stop all animations when respawning
    if (this.animationGroups) {
        this.animationGroups.forEach(ag => ag.stop());
    }
  }

  applyFreeze(durationMs) {
    this.freezeEndTime = Math.max(
      this.freezeEndTime,
      window.gameTime + durationMs,
    );
    this.showFloatingText("FREEZED", "#44ccff");
  }

  applySlow(durationMs) {
    this.slowEndTime = Math.max(this.slowEndTime, window.gameTime + durationMs);
    this.showFloatingText("SLOWED", "#d2691e");
  }

  heal(amount) {
    this.hp += amount;
    this.showFloatingText("+" + amount, "#44ff44");
  }

  update(player, spatialGrid) {
    if (this.isDead || player.isDead || this.isTornadoSucked) {
        try {
            if (this.runAnims) this.runAnims.forEach(ag => { if (ag) ag.stop(); });
        } catch(e) {}
        return;
    }

    // Helper pour détecter les décorations (arbres, rochers) qui ne sont pas du sol
    const isObstacle = (mesh) => {
      let curr = mesh;
      while (curr) {
        if (curr.name && curr.name.includes("deco_")) {
          if (curr.name.toLowerCase().includes("rubble")) return false;
          return true;
        }
        curr = curr.parent;
      }
      return false;
    };

    let currentTime = window.gameTime;

    // Apply knockback decay
    if (this.knockbackVelocity.lengthSquared() > 0.001) {
        this.knockbackVelocity.scaleInPlace(0.9); // Friction
    } else {
        this.knockbackVelocity.set(0, 0, 0);
    }

    if (currentTime < this.freezeEndTime) {
        // Even if frozen, knockback still applies
        if (this.knockbackVelocity.lengthSquared() > 0.001) {
            this.mesh.position.addInPlace(this.knockbackVelocity);
        }
        try {
            if (this.runAnims) this.runAnims.forEach(ag => { if (ag) ag.speedRatio = 0; });
        } catch(e) {}
        return;
    }

    const distance = BABYLON.Vector3.Distance(
      this.mesh.position,
      player.mesh.position,
    );

    // -- LOGIQUE D'ATTAQUE --
    if (distance < this.attackRange && !this.isAttacking) {
      this.startAttack(player);
    }

    // Si on attaque, on ne bouge pas (sauf knockback)
    if (this.isAttacking) {
        if (this.knockbackVelocity.lengthSquared() > 0.001) {
            this.mesh.position.addInPlace(this.knockbackVelocity);
        }
        try {
            if (this.runAnims) this.runAnims.forEach(ag => { if (ag) ag.stop(); });
        } catch(e) {}
        return;
    }

    // Separation force — O(1) grâce à la SpatialHashGrid
    let separation = new BABYLON.Vector3(0, 0, 0);
    if (spatialGrid) {
      const nearby = spatialGrid.queryNearby(this, 1.5);
      for (const other of nearby) {
        if (other.isTornadoSucked) continue;
        let d = BABYLON.Vector3.Distance(
          this.mesh.position,
          other.mesh.position,
        );
        if (d > 0 && d < 1.5) {
          let push = this.mesh.position.subtract(other.mesh.position);
          push.normalize();
          push.scaleInPlace((1.5 - d) * 0.1);
          separation.addInPlace(push);
        }
      }
    }

    const direction = player.mesh.position.subtract(this.mesh.position);
    direction.y = 0;
    if (direction.length() > 0.1) {
      direction.normalize();

      let currentSpeed = this.speed;
      let animSpeed = 1.0;
      if (currentTime < this.slowEndTime) {
        currentSpeed *= 0.5;
        animSpeed = 0.5;
      }

      try {
          if (this.runAnims) {
              this.runAnims.forEach(ag => {
                  if (ag && !ag.isPlaying) ag.play(true);
                  if (ag) ag.speedRatio = animSpeed;
              });
          }
      } catch (e) {
          // Si l'animation plante, on ne bloque pas le mouvement
      }

      let moveVec = direction.scale(currentSpeed);
      moveVec.addInPlace(separation);
      moveVec.addInPlace(this.knockbackVelocity); // Add knockback!

      // --- SYSTÈME FEELER (Raycast Prédictif pour les ennemis) ---
      const dX = moveVec.x;
      const dZ = moveVec.z;
      const feelerRadius = 0.6; // Augmenté pour détecter les bords de trous plus tôt
      let targetY = this.mesh.position.y;

      const checkWalkable = (offsetX, offsetZ) => {
        let vec = new BABYLON.Vector3(offsetX, 0, offsetZ);
        if (vec.lengthSquared() > 0.001) vec.normalize();

        const testX = this.mesh.position.x + offsetX + vec.x * feelerRadius;
        const testZ = this.mesh.position.z + offsetZ + vec.z * feelerRadius;

        // OPTIMISATION ULTIME : Évaluation mathématique O(1) sans aucun Raycast !
        // (Évite 6000 vérifications de collision par seconde quand il y a 50 ennemis)
        if (window.terrainNoiseGen && window.terrainPitGen) {
            const TILE_SIZE = 2;
            const tileX = Math.floor(testX / TILE_SIZE);
            const tileZ = Math.floor(testZ / TILE_SIZE);

            if (window.terrainNoiseGen.isLava(tileX, tileZ)) return false;
            if (window.terrainPitGen.isPit(tileX, tileZ)) return false;
        }

        // Le sol est toujours à Y=1.0 dans le monde physique.
        targetY = 1.0;

        // --- DÉTECTION DES OBSTACLES (Arbres, Ruines) ---
        // Raycast très court uniquement vers l'avant, très rapide O(1) grâce au boolean
        const rayOrigin = new BABYLON.Vector3(
          this.mesh.position.x,
          this.mesh.position.y + 0.5,
          this.mesh.position.z
        );
        const ray = new BABYLON.Ray(rayOrigin, new BABYLON.Vector3(vec.x, 0, vec.z), feelerRadius + 0.5);
        
        const hitInfo = this.scene.pickWithRay(ray, (m) => {
            let curr = m;
            while(curr) {
                if (curr.isObstacleEnvironment === true) return true;
                curr = curr.parent;
            }
            return false;
        });
        if (hitInfo.hit) {
            return false; // Obstacle détecté !
        }

        return true;
      };

      // Application du mouvement avec glissement
      if (checkWalkable(dX, dZ)) {
        this.mesh.position.x += dX;
        this.mesh.position.z += dZ;
      } else if (Math.abs(dX) > 0.0001 && checkWalkable(dX, 0)) {
        this.mesh.position.x += dX;
      } else if (Math.abs(dZ) > 0.0001 && checkWalkable(0, dZ)) {
        this.mesh.position.z += dZ;
      }
      
      // Interpoler doucement vers la nouvelle hauteur du sol
      // On compense le fait que l'origine du mesh peut varier selon s'il est custom ou non
      const yOffset = this.isCustom ? 0 : 1; 
      this.mesh.position.y = BABYLON.Scalar.Lerp(this.mesh.position.y, targetY + yOffset, 0.2);

      this.mesh.lookAt(
        new BABYLON.Vector3(
          player.mesh.position.x,
          this.mesh.position.y,
          player.mesh.position.z,
        ),
      );
    }
  }

  startAttack(player) {
    // Sera surchargé par les classes dérivées pour gérer les animations GLB
    this.isAttacking = true;
    console.log("Enemy start attack");
  }

  takeDamage(amount) {
    if (amount > 0) {
      this.hp -= amount;
      this.showFloatingText("-" + amount, "#ff4444");
    }
    if (this.hp <= 0) {
      this.die();
    }
  }

  showFloatingText(text, colorString) {
    if (this.isDead || !this.mesh) return;

    const scene = this.scene;
    const plane = BABYLON.MeshBuilder.CreatePlane(
      "floatingText",
      { width: 2, height: 1 },
      scene,
    );
    plane.position = this.mesh.position.clone();
    plane.position.y += 2;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dynTexture = new BABYLON.DynamicTexture(
      "dynamic texture",
      { width: 512, height: 256 },
      scene,
      true,
    );
    dynTexture.hasAlpha = true;

    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.emissiveTexture = dynTexture;
    mat.diffuseTexture = dynTexture;
    mat.opacityTexture = dynTexture;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    plane.material = mat;

    const ctx = dynTexture.getContext();
    ctx.clearRect(0, 0, 512, 256);
    ctx.font = "bold 60px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colorString;
    ctx.fillText(text, 256, 128);
    dynTexture.update();

    const duration = 1000;
    const startTime = performance.now();
    const startY = plane.position.y;

    const observer = scene.onBeforeRenderObservable.add(() => {
      let elapsed = performance.now() - startTime;
      if (elapsed > duration) {
        scene.onBeforeRenderObservable.remove(observer);
        plane.dispose();
        mat.dispose();
        dynTexture.dispose();
      } else {
        let progress = elapsed / duration;
        plane.position.y = startY + progress * 2;
        mat.alpha = 1.0 - progress;
      }
    });
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.deathPosition = this.mesh.position.clone();
    
    // Stop all animations
    if (this.animationGroups) {
        this.animationGroups.forEach(ag => ag.stop());
    }

    // Hide mesh
    this.mesh.setEnabled(false);

    // Release to pool
    if (window.enemyPool) {
        window.enemyPool.release(this);
    }
  }
}
