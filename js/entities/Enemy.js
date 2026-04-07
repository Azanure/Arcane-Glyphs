export class Enemy {
    constructor(scene, playerPos, radius, color = new BABYLON.Color3(1, 0, 0), customMesh = null) {
        this.scene = scene;
        this.hp = 100;
        this.speed = 0.035; // Vitesse
        this.damage = 10;
        this.experienceValue = 5;
        this.lastDamageTime = 0;
        this.damageCooldown = 1500; // Un peu plus long car lié à l'animation
        this.attackRange = 1.8; // Distance pour lancer l'attaque
        this.isAttacking = false;
        this.animationGroups = [];

        if (customMesh) {
            this.mesh = customMesh;
        } else {
            this.mesh = BABYLON.MeshBuilder.CreateCapsule("enemy", {height: 2, radius: 0.5}, scene);
            const mat = new BABYLON.StandardMaterial("enemyMat", scene);
            mat.diffuseColor = color;
            this.mesh.material = mat;
        }
        
        // --- HITBOX ENNEMI ---
        this.hitbox = BABYLON.MeshBuilder.CreateBox("enemyHitbox", {size: 1.2}, scene);
        this.hitbox.parent = this.mesh;
        this.hitbox.position.y = 1;
        this.hitbox.isPickable = false;
        const hbMat = new BABYLON.StandardMaterial("hbMat", scene);
        hbMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
        hbMat.alpha = 0.2;
        this.hitbox.material = hbMat;

        const angle = Math.random() * Math.PI * 2;
        this.mesh.position.x = playerPos.x + Math.cos(angle) * radius;
        this.mesh.position.z = playerPos.z + Math.sin(angle) * radius;
        this.mesh.position.y = customMesh ? 0 : 1; 
        
        // Orientation initiale
        this.mesh.lookAt(new BABYLON.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
        
        this.isDead = false;
        this.deathPosition = null;
        this.freezeEndTime = 0;
        this.slowEndTime = 0;
    }

    applyFreeze(durationMs) {
        this.freezeEndTime = Math.max(this.freezeEndTime, window.gameTime + durationMs);
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

    update(player, enemies) {
        if (this.isDead || player.isDead) return;

        let currentTime = window.gameTime;
        
        if (currentTime < this.freezeEndTime) return;

        const distance = BABYLON.Vector3.Distance(this.mesh.position, player.mesh.position);
        
        // -- LOGIQUE D'ATTAQUE --
        if (distance < this.attackRange && !this.isAttacking) {
            this.startAttack(player);
        }

        // Si on attaque, on ne bouge pas
        if (this.isAttacking) return;

        // Separation force
        let separation = new BABYLON.Vector3(0, 0, 0);
        if (enemies) {
            for (let other of enemies) {
                if (other === this || other.isDead) continue;
                let d = BABYLON.Vector3.Distance(this.mesh.position, other.mesh.position);
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
            if (currentTime < this.slowEndTime) {
                currentSpeed *= 0.5;
            }

            let moveVec = direction.scale(currentSpeed);
            moveVec.addInPlace(separation);
            
            this.mesh.position.addInPlace(moveVec);
            
            this.mesh.lookAt(new BABYLON.Vector3(player.mesh.position.x, this.mesh.position.y, player.mesh.position.z));
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
        const plane = BABYLON.MeshBuilder.CreatePlane("floatingText", {width: 2, height: 1}, scene);
        plane.position = this.mesh.position.clone();
        plane.position.y += 2;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const dynTexture = new BABYLON.DynamicTexture("dynamic texture", {width:512, height:256}, scene, true);
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
        this.isDead = true;
        this.deathPosition = this.mesh.position.clone();
        this.mesh.dispose();
    }
}
