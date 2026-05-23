import { Projectile } from "./Projectile.js";
import { SpellDatabase } from "../configs/SpellDatabase.js";
import { SpellUpgradesDatabase } from "../configs/SpellUpgradesDatabase.js";

export class Player {
  constructor(scene, sharedState = null) {
    this.scene = scene;
    this.baseSpeed = 0.1;

    // --- Statistiques du joueur ---
    // Initialisation depuis le sharedState si disponible (transitions inter-scènes)
    this.maxHp = sharedState?.playerMaxHp ?? 100;
    this.hp = sharedState?.playerHp ?? 100;
    this.level = sharedState?.playerLevel ?? 1;
    this.xp = sharedState?.playerXp ?? 0;
    this.xpToNextLevel = sharedState?.playerXpToNextLevel ?? 10;
    this.damage = sharedState?.playerDamage ?? 25;
    this.speed = sharedState?.playerSpeed ?? 0.1;
    this.speedMultiplier = 1.0;
    this.shootCooldown = sharedState?.playerShootCooldown ?? 1000;
    this.upgradeLevels = sharedState ? { ...sharedState.upgradeLevels } : {};
    this.spellLevels = sharedState?.spellLevels || {};
    this.attractionRadius = sharedState?.playerXpRadius ?? 10;
    this.hpRegen = sharedState?.playerHpRegen ?? 0;
    this.isDead = false;
    this._fallSpeed = 0; // Vitesse de chute accumulée

    // --- SCORE & TIMER ---
    this.score = 0;
    this.enemiesKilled = 0;

    // --- CHARACTER CONTROLLER : Capsule invisible ---
    // On utilise une capsule (standard AAA pour les humanoïdes) comme proxy physique.
    // Elle porte le checkCollisions pour le mouvement XZ (contre les murs/bords de trous).
    // La gravité est gérée par un Raycast vertical, pas par moveWithCollisions.
    this.scene.collisionsEnabled = true;
    this.mesh = BABYLON.MeshBuilder.CreateCapsule(
      "playerCapsule",
      {
        radius: 0.3,
        height: 1.4,
        tessellation: 8, // Polygones réduits pour les perfs
      },
      this.scene,
    );
    this.mesh.isVisible = false;
    this.mesh.checkCollisions = true; // Pour le mouvement XZ uniquement (contre les murs)
    this.mesh.ellipsoid = new BABYLON.Vector3(0.3, 0.7, 0.3);
    this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 0.7, 0);
    this.mesh.position.y = 3.0; // Spawn au-dessus, retombe via le Raycast sol

    // --- SELECTION DU PERSONNAGE ---
    this.selectedCharacterName = sharedState?.selectedCharacterName || "brand";

    // --- CHARGEMENT DU VISUEL ---
    this.visualMesh = null;
    this.hitbox = null;

    // On attend que les templates soient prêts (normalement chargés dans main.js)
    setTimeout(() => {
      this.setupPlayerVisual();
    }, 100);

    // Tir automatique
    this.baseShootCooldown = 1000;
    this.lastShootTime = 0;
    this.projectiles = [];
    this.baseDamage = 25;
    this.maxDamage = 75;
    this.maxSpeed = 0.25;
    this.minShootCooldown = 100;

    // --- Système d'Améliorations (déjà initialisé depuis sharedState) ---

    // --- Statistiques d'utilisation des éléments (IA Director) ---
    this.elementStats = {
      FIRE: 0,
      AIR: 0,
      WATER: 0,
      EARTH: 0,
      MAGMA: 0,
      LIGHTNING: 0,
      ICE: 0,
      POISON: 0,
      TIME: 0,
      LIGHT: 0,
      SPACE: 0,
      VOID: 0,
      NONE: 0,
    };

    // --- Système de Sélection (Level Up) ---
    this.activeCardChoices = [];

    this.visualMesh = null; // Gérer le modèle statique

    this.updateUI();
    this.setupUpgrades();

    // Raycast utility
    this.downRay = new BABYLON.Ray(
      BABYLON.Vector3.Zero(),
      new BABYLON.Vector3(0, -1, 0),
      10,
    );
  }

  setupPlayerVisual() {
    this.changeCharacterMesh();
  }

  changeCharacterMesh(characterData) {
    const modelName =
      characterData?.modelName || characterData?.name?.toLowerCase() || this.selectedCharacterName || "brand";
    this.selectedCharacterName = modelName;
    const template = window.characterTemplates?.[modelName];
    if (!template) return;

    // Retirer l'ancien visuel
    if (this.visualMeshes) {
        this.visualMeshes.forEach(m => { if (m) m.dispose(); });
    } else if (this.visualMesh) {
        this.visualMesh.dispose();
    }
    if (this.hitbox) {
      this.hitbox.dispose();
      this.hitbox = null;
    }

    this.visualMeshes = [];
    this.currentAnimState = "idle";

    const initVisual = (mesh) => {
        mesh.scaling = new BABYLON.Vector3(1.4, 1.4, 1.4);
        mesh.position = new BABYLON.Vector3(0, 0.7, 0);
        // By default character faces right in GLB usually, or forward. Let's keep original setup rotation for now.
        mesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        this.visualMeshes.push(mesh);
    };

    if (template.idleContainer) {
        let inst = template.idleContainer.instantiateModelsToScene(name => name + "_playerIdle", true);
        this.idleMesh = inst.rootNodes[0];
        this.idleMesh.parent = this.mesh;
        initVisual(this.idleMesh);
        if (inst.animationGroups) inst.animationGroups.forEach(ag => ag.play(true));
    } else {
        this.idleMesh = template.mesh.clone("playerIdle", this.mesh);
        initVisual(this.idleMesh);
    }

    if (template.runContainer) {
        let inst = template.runContainer.instantiateModelsToScene(name => name + "_playerRun", true);
        this.runMesh = inst.rootNodes[0];
        this.runMesh.parent = this.mesh;
        initVisual(this.runMesh);
        this.runMesh.setEnabled(false); // caché
        if (inst.animationGroups) inst.animationGroups.forEach(ag => ag.play(true));
    } else {
        this.runMesh = null;
    }

    this.hitbox = template.mesh.clone("playerHitbox", this.mesh);
    this.hitbox.setEnabled(true);

    const haloMat = new BABYLON.StandardMaterial("haloMat", this.scene);
    haloMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
    haloMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
    haloMat.alpha = 0.3;
    this.hitbox.getChildMeshes().forEach((m) => {
      m.isVisible = false; // Hitbox invisible
      m.isPickable = false;
      m.checkCollisions = false;
    });

    this.hitbox.scaling = new BABYLON.Vector3(1.4, 1.4, 1.4);
    this.hitbox.position = new BABYLON.Vector3(0, 0.7, 0);
    this.hitbox.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.hitbox.checkCollisions = false;
    this.hitbox.isPickable = false;
  }

  /**
   * Sauvegarde les stats courantes dans le SharedGameState avant de disposer la scène.
   */
  exportState(sharedState) {
    if (!sharedState) return;
    sharedState.playerHp = this.hp;
    sharedState.playerMaxHp = this.maxHp;
    sharedState.playerXp = this.xp;
    sharedState.playerLevel = this.level;
    sharedState.playerXpToNextLevel = this.xpToNextLevel;
    sharedState.playerDamage = this.damage;
    sharedState.playerSpeed = this.speed;
    sharedState.playerShootCooldown = this.shootCooldown;
    sharedState.playerHpRegen = this.hpRegen;
    sharedState.playerXpRadius = this.attractionRadius;
    sharedState.upgradeLevels = { ...this.upgradeLevels };
    sharedState.spellLevels = { ...this.spellLevels };
    console.log("[Player] Stats exportées dans SharedGameState.");
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    this.updateUI();
  }

  gainXp(amount) {
    if (this.isDead) return;
    this.xp += amount;
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      // Courbe d'XP plus exigeante (10 -> 28 -> 51 -> 80 -> 111...)
      this.xpToNextLevel = Math.floor(10 * Math.pow(this.level, 1.5));
      this.hp = this.maxHp; // Heal to full on level up

      window.isGamePaused = true;
      this.showLevelUpMenu();
    }
    this.updateUI();
  }

  addScore(points) {
    if (this.isDead) return;
    this.score += points;
    this.enemiesKilled++;
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.mesh.rotation.x = Math.PI / 2; // Animation de chute
    
    // Save Score
    let survivalTimeSeconds = Math.floor((window.gameTime || 0) / 1000);
    let finalScore = this.score;

    let scores = JSON.parse(localStorage.getItem('arcane_glyphs_scores') || '[]');
    scores.push({ score: finalScore, time: survivalTimeSeconds, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score); // Highest score first
    scores = scores.slice(0, 10); // Keep top 10
    localStorage.setItem('arcane_glyphs_scores', JSON.stringify(scores));

    // Show Game Over UI
    const gameOverScreen = document.getElementById("gameOverScreen");
    if (gameOverScreen) {
      gameOverScreen.classList.remove("hidden");
      
      const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
      };

      document.getElementById("finalTimeText").innerText = `Time: ${formatTime(survivalTimeSeconds)}`;
      document.getElementById("finalScoreText").innerText = `Score: ${finalScore}`;

      const tbody = document.querySelector("#leaderboardTable tbody");
      if (tbody) {
        tbody.innerHTML = '';
        scores.forEach((s, index) => {
          tbody.innerHTML += `
            <tr>
              <td style="padding: 5px;">#${index + 1}</td>
              <td style="padding: 5px;">${formatTime(s.time)}</td>
              <td style="padding: 5px;">${s.score}</td>
            </tr>
          `;
        });
      }
    }
    
    // Pause the game loop
    window.isGamePaused = true;

    // Le retour au Hub se fera manuellement via le bouton (géré dans LevelScene)
  }

  updateUI() {
    // Find UI elements
    const hpBar = document.getElementById("hpBar");
    const hpText = document.getElementById("hpText");
    const xpBar = document.getElementById("xpBar");
    const xpText = document.getElementById("xpText");

    if (hpBar && hpText) {
      const hpPercent = Math.max(0, (this.hp / this.maxHp) * 100);
      hpBar.style.width = hpPercent + "%";
      hpText.innerText = `HP: ${Math.floor(this.hp)}/${this.maxHp}`;
    }

    if (xpBar && xpText) {
      const xpPercent = Math.min(
        100,
        Math.max(0, (this.xp / this.xpToNextLevel) * 100),
      );
      xpBar.style.width = xpPercent + "%";
      xpText.innerText = `Level ${this.level} - XP: ${Math.floor(this.xp)}/${this.xpToNextLevel}`;
    }
  }

  setupUpgrades() {
    // Obsolete function, dynamic assignment is done inside showLevelUpMenu
  }

  recordSpellUsage(element) {
    if (this.elementStats[element] !== undefined) {
      this.elementStats[element]++;
    } else {
      this.elementStats.NONE++;
    }
    console.log("Statistiques Éléments Joueur:", this.elementStats);
  }

  showLevelUpMenu() {
    const levelUpScreen = document.getElementById("levelUpScreen");
    if (!levelUpScreen) return;

    // --- PARAMETRES DE CONFIGURATION PERSONNELLE ---
    const BASE_WEIGHT = 10;
    const LOW_LEVEL_BONUS = 15;
    // -----------------------------------------------

    if (this.upgradeLevels.speed === undefined) this.upgradeLevels.speed = 0;
    if (this.upgradeLevels.maxHp === undefined) this.upgradeLevels.maxHp = 0;
    if (this.upgradeLevels.hpRegen === undefined) this.upgradeLevels.hpRegen = 0;
    if (this.upgradeLevels.xpRadius === undefined) this.upgradeLevels.xpRadius = 0;

    let activeSpells = window.activeSpellIds || [];
    activeSpells.forEach((id) => {
      if (this.spellLevels[id] === undefined) {
        this.spellLevels[id] = 1; // Spell starts at level 1
      }
    });

    let availablePool = [];
    let spellPool = [];

    // Stats Joueur (10 niveaux max par stat)
    if (this.upgradeLevels.speed < 10) {
      availablePool.push({
        id: "speed", type: "player",
        weight: BASE_WEIGHT + (10 - this.upgradeLevels.speed) * LOW_LEVEL_BONUS,
      });
    }
    if (this.upgradeLevels.maxHp < 10) {
      availablePool.push({
        id: "maxHp", type: "player",
        weight: BASE_WEIGHT + (10 - this.upgradeLevels.maxHp) * LOW_LEVEL_BONUS,
      });
    }
    if (this.upgradeLevels.hpRegen < 10) {
      availablePool.push({
        id: "hpRegen", type: "player",
        weight: BASE_WEIGHT + (10 - this.upgradeLevels.hpRegen) * LOW_LEVEL_BONUS,
      });
    }
    if (this.upgradeLevels.xpRadius < 10) {
      availablePool.push({
        id: "xpRadius", type: "player",
        weight: BASE_WEIGHT + (10 - this.upgradeLevels.xpRadius) * LOW_LEVEL_BONUS,
      });
    }

    // Spells Upgrades
    activeSpells.forEach((id) => {
      const currentLevel = this.spellLevels[id];
      const upgrades = SpellUpgradesDatabase[id];
      if (upgrades) {
        const nextUpgrade = upgrades.find(u => u.level === currentLevel + 1);
        if (nextUpgrade) {
          spellPool.push({
            id: id, type: "spell",
            upgrade: nextUpgrade,
            weight: BASE_WEIGHT + (5 - currentLevel) * LOW_LEVEL_BONUS, // Favoriser les petits niveaux
          });
        }
      }
    });

    let selectedUpgrades = [];

    const pickRandomWeighted = (pool) => {
      const rng = window.rng;
      let totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
      let r = (rng ? rng.next() : Math.random()) * totalWeight;
      let current = 0;
      for (let i = 0; i < pool.length; i++) {
        current += pool[i].weight;
        if (r <= current) return pool.splice(i, 1)[0];
      }
      return null;
    };

    if (spellPool.length > 0) {
      selectedUpgrades.push(pickRandomWeighted(spellPool));
    }

    let combinedPool = availablePool.concat(spellPool);
    while (selectedUpgrades.length < 3 && combinedPool.length > 0) {
      selectedUpgrades.push(pickRandomWeighted(combinedPool));
    }

    if (window.rng) {
      window.rng.shuffle(selectedUpgrades);
    } else {
      selectedUpgrades.sort(() => Math.random() - 0.5);
    }

    const closeAndResume = () => {
      levelUpScreen.classList.add("hidden");
      window.isGamePaused = false;
    };

    this.activeCardChoices = [];

    const cardIds = ["card1", "card2", "card3"];
    cardIds.forEach((id, index) => {
      const cardEl = document.getElementById(id);
      if (!cardEl) return;

      if (index < selectedUpgrades.length) {
        cardEl.style.visibility = "visible";
        const upg = selectedUpgrades[index];

        const titleEl = cardEl.querySelector(".card-title");
        const descEl = cardEl.querySelector(".card-description");

        let title = "";
        let description = "";
        let action = null;

        if (upg.type === "player") {
          if (upg.id === "speed") {
            let next = this.speed + 0.01;
            title = "Swiftness";
            description = `Increases movement speed.<br><s>${(this.speed * 100).toFixed(0)}</s> ➔ ${(next * 100).toFixed(0)}`;
            action = () => { this.speed = next; this.upgradeLevels.speed++; closeAndResume(); };
          } else if (upg.id === "maxHp") {
            let next = this.maxHp + 20;
            title = "Vitality";
            description = `Increases Max HP.<br><s>${this.maxHp}</s> ➔ ${next}`;
            action = () => { this.maxHp = next; this.hp += 20; this.upgradeLevels.maxHp++; closeAndResume(); };
          } else if (upg.id === "hpRegen") {
            let next = this.hpRegen + 1;
            title = "Regeneration";
            description = `Heal HP over time.<br><s>${this.hpRegen}/s</s> ➔ ${next}/s`;
            action = () => { this.hpRegen = next; this.upgradeLevels.hpRegen++; closeAndResume(); };
          } else if (upg.id === "xpRadius") {
            let next = this.attractionRadius + 2;
            title = "Magnetism";
            description = `Increases XP pickup radius.<br><s>${this.attractionRadius}m</s> ➔ ${next}m`;
            action = () => { this.attractionRadius = next; this.upgradeLevels.xpRadius++; closeAndResume(); };
          }
        } else if (upg.type === "spell") {
          const spell = SpellDatabase[upg.id];
          const upgradeData = upg.upgrade;
          title = `${spell.name} Lvl ${upgradeData.level}`;
          description = `<b>${upgradeData.title}</b><br>${upgradeData.description}`;
          action = () => {
            upgradeData.apply(spell);
            this.spellLevels[upg.id] = upgradeData.level;
            closeAndResume();
          };
        }

        if (titleEl) titleEl.innerHTML = title;
        if (descEl) descEl.innerHTML = description;

        const newCard = cardEl.cloneNode(true);
        cardEl.parentNode.replaceChild(newCard, cardEl);
        newCard.addEventListener("click", () => {
          if (action) action();
        });

        this.activeCardChoices.push({ element: newCard, action: action });
      } else {
        cardEl.style.visibility = "hidden";
      }
    });

    levelUpScreen.classList.remove("hidden");
  }

  handleLevelUpInteraction(cursorX, cursorY) {
    if (!this.activeCardChoices || this.activeCardChoices.length === 0) return;

    this.activeCardChoices.forEach((choice) => {
      const rect = choice.element.getBoundingClientRect();
      const wasHovered = choice.element.classList.contains("hovered");
      const isHoveredNow =
        cursorX >= rect.left &&
        cursorX <= rect.right &&
        cursorY >= rect.top &&
        cursorY <= rect.bottom;

      if (isHoveredNow) {
        if (!wasHovered) choice.element.classList.add("hovered");

        // Si survolé ET main ouverte -> Sélection
        if (window.isOpenPalm) {
          console.log("[PLAYER] Upgrade sélectionnée par Main Ouverte !");
          if (choice.action) choice.action();
          this.activeCardChoices = []; // On vide pour éviter les répétitions
        }
      } else {
        if (wasHovered) choice.element.classList.remove("hovered");
      }
    });
  }

  update(inputManager, enemies = []) {
    if (this.isDead) return;

    // HP Regen
    if (this.hpRegen > 0 && this.hp < this.maxHp) {
      let dt = this.scene.getEngine().getDeltaTime();
      this.hp = Math.min(this.maxHp, this.hp + this.hpRegen * (dt / 1000));
      this.updateUI();
    }

    // Helper pour détecter les décorations (arbres, rochers) qui ne sont pas du sol
    const isObstacle = (mesh) => {
      let curr = mesh;
      while (curr) {
        if (curr.name && curr.name.includes("deco_")) {
          // On laisse passer le ruban/débris au sol
          if (curr.name.toLowerCase().includes("rubble")) return false;
          return true;
        }
        curr = curr.parent;
      }
      return false;
    };

    // --- 1. Gestion du Mouvement ---
    // 1. On récupère la caméra de la scène
    const camera = this.scene.activeCamera;
    if (!camera) return;

    // 2. On calcule vers où pointent l'"Avant" et la "Droite" de la caméra
    let camForward = camera.getDirection(new BABYLON.Vector3(0, 0, 1));
    let camRight = camera.getDirection(new BABYLON.Vector3(1, 0, 0));

    // CRUCIAL : On met l'axe Y à 0 pour éviter que le joueur ne s'envole
    // ou ne s'enfonce dans le sol, car la caméra est penchée vers le bas !
    camForward.y = 0;
    camRight.y = 0;

    // On normalise pour que la direction soit bien de longueur 1
    camForward.normalize();
    camRight.normalize();

    // 3. On lit nos entrées clavier (1 pour avancer, -1 pour reculer, 0 sinon)
    let zInput = 0;
    let xInput = 0;

    // Touches dynamiques selon le layout clavier (AZERTY ou QWERTY)
    // On utilise isCharPressed() avec e.key (caractère affiché) — pas e.code (position physique)
    // car sur un clavier AZERTY, la touche Z envoie e.key='z' mais e.code='KeyW'.
    const layout = window.keyLayout ?? 'QWERTY';
    const KEY_FWD   = layout === 'AZERTY' ? 'z' : 'w';
    const KEY_BACK  = 's';
    const KEY_LEFT  = layout === 'AZERTY' ? 'q' : 'a';
    const KEY_RIGHT = 'd';

    if (inputManager.isCharPressed(KEY_FWD))   zInput += 1;
    if (inputManager.isCharPressed(KEY_BACK))  zInput -= 1;
    if (inputManager.isCharPressed(KEY_LEFT))  xInput -= 1;
    if (inputManager.isCharPressed(KEY_RIGHT)) xInput += 1;

    // 4. On combine les directions de la caméra avec nos inputs
    // Ex: Si zInput vaut 1, on ajoute un vecteur "Avant".
    let moveDirection = camForward.scale(zInput).add(camRight.scale(xInput));

    // 5. On normalise pour les déplacements en diagonale
    if (moveDirection.length() > 0) {
      moveDirection.normalize();
      
      // Update animation state to 'run'
      if (this.currentAnimState !== "run") {
          this.currentAnimState = "run";
          if (this.runMesh) {
              if (this.idleMesh) this.idleMesh.setEnabled(false);
              this.runMesh.setEnabled(true);
          }
      }
      
      // Optional: rotate the player visual towards movement direction
      // We add Math.PI because the character's local rotation is Math.PI, meaning their default forward is backward in world space.
      let angle = Math.atan2(moveDirection.x, moveDirection.z);
      this.mesh.rotation.y = angle + Math.PI;
      
    } else {
      // Update animation state to 'idle'
      if (this.currentAnimState !== "idle") {
          this.currentAnimState = "idle";
          if (this.idleMesh) this.idleMesh.setEnabled(true);
          if (this.runMesh) this.runMesh.setEnabled(false);
      }
    }

    const dX = moveDirection.x * (this.speed * this.speedMultiplier);
    const dZ = moveDirection.z * (this.speed * this.speedMultiplier);

    // --- SYSTÈME FEELER (Raycast Prédictif) ---
    // Remplace moveWithCollisions. On vérifie la topologie du mesh AVANT de s'y déplacer.
    if (Math.abs(dX) > 0.0001 || Math.abs(dZ) > 0.0001) {
      const feelerRadius = 0.25; // Distance devant
      const sideOffset = 0.3; // Écartement des moustaches pour couvrir la largeur

      const checkWalkable = (offsetX, offsetZ) => {
        let vec = new BABYLON.Vector3(offsetX, 0, offsetZ);
        if (vec.length() > 0) vec.normalize();

        // Vecteur perpendiculaire pour décaler les rayons à gauche et à droite
        const perp = new BABYLON.Vector3(-vec.z, 0, vec.x).normalize();

        // On va tester 3 points : le centre, et deux "moustaches" sur les côtés
        const pointsToTest = [
          // Centre
          new BABYLON.Vector3(
            this.mesh.position.x + offsetX + vec.x * feelerRadius,
            this.mesh.position.y + 2.0,
            this.mesh.position.z + offsetZ + vec.z * feelerRadius,
          ),
          // Gauche
          new BABYLON.Vector3(
            this.mesh.position.x +
              offsetX +
              vec.x * feelerRadius +
              perp.x * sideOffset,
            this.mesh.position.y + 2.0,
            this.mesh.position.z +
              offsetZ +
              vec.z * feelerRadius +
              perp.z * sideOffset,
          ),
          // Droite
          new BABYLON.Vector3(
            this.mesh.position.x +
              offsetX +
              vec.x * feelerRadius -
              perp.x * sideOffset,
            this.mesh.position.y + 2.0,
            this.mesh.position.z +
              offsetZ +
              vec.z * feelerRadius -
              perp.z * sideOffset,
          ),
        ];

        for (let testPos of pointsToTest) {
          const ray = new BABYLON.Ray(testPos, BABYLON.Vector3.Down(), 5.0);
          const hits = this.scene.multiPickWithRay(ray, (m) => {
            return (
              m.isPickable &&
              m.isEnabled() &&
              !m.name.includes("player") &&
              !m.name.includes("Capsule")
            );
          });

          let isBlocked = false;

          if (!hits || hits.length === 0) {
            isBlocked = true;
          } else {
            // 1. Détection lave
            let hitLava = hits.find(
              (h) =>
                h.pickedMesh.name.includes("lava_col") ||
                h.pickedMesh.name.includes("lava_debug"),
            );
            if (hitLava) {
              isBlocked = true;
            } else {
              // 2. Détection obstacles (arbres, rochers)
              let hitObstacle = hits.find((h) => isObstacle(h.pickedMesh));
              if (hitObstacle) {
                isBlocked = true;
              } else {
                // 3. Détection hauteur (murs, ruines trop hautes)
                let highestHit = hits.reduce((prev, curr) =>
                  prev.pickedPoint.y > curr.pickedPoint.y ? prev : curr,
                );
                if (highestHit.pickedPoint.y < this.mesh.position.y - 0.5)
                  isBlocked = true;
                else if (highestHit.pickedPoint.y > this.mesh.position.y + 0.5)
                  isBlocked = true;
              }
            }
          }

          if (isBlocked) return false;
        }

        return true;
      };

      // Mouvement XZ avec glissement (sliding)
      if (checkWalkable(dX, dZ)) {
        this.mesh.position.x += dX;
        this.mesh.position.z += dZ;
      } else if (Math.abs(dX) > 0.0001 && checkWalkable(dX, 0)) {
        this.mesh.position.x += dX;
      } else if (Math.abs(dZ) > 0.0001 && checkWalkable(0, dZ)) {
        this.mesh.position.z += dZ;
      }
    }

    // --- GRAVITÉ avec multi-échantillonnage (Axe Y) ---
    // On teste 5 points (centre + 4 coins de l'emprise au sol) pour monter dès que le bord touche un relief
    const FOOT_RADIUS = 0.3;
    const testPoints = [
      new BABYLON.Vector3(
        this.mesh.position.x,
        this.mesh.position.y + 0.5,
        this.mesh.position.z,
      ),
      new BABYLON.Vector3(
        this.mesh.position.x + FOOT_RADIUS,
        this.mesh.position.y + 0.5,
        this.mesh.position.z,
      ),
      new BABYLON.Vector3(
        this.mesh.position.x - FOOT_RADIUS,
        this.mesh.position.y + 0.5,
        this.mesh.position.z,
      ),
      new BABYLON.Vector3(
        this.mesh.position.x,
        this.mesh.position.y + 0.5,
        this.mesh.position.z + FOOT_RADIUS,
      ),
      new BABYLON.Vector3(
        this.mesh.position.x,
        this.mesh.position.y + 0.5,
        this.mesh.position.z - FOOT_RADIUS,
      ),
    ];

    let highestY = -999;
    let foundHit = false;

    for (const point of testPoints) {
      const ray = new BABYLON.Ray(point, BABYLON.Vector3.Down(), 2.5);
      const hit = this.scene.pickWithRay(ray, (m) => {
        if (!m.isPickable || !m.isEnabled() || isObstacle(m)) return false;
        return !m.name.includes("player") && !m.name.includes("Capsule");
      });

      if (hit.hit) {
        foundHit = true;
        if (hit.pickedPoint.y > highestY) highestY = hit.pickedPoint.y;
      }
    }

    if (foundHit && highestY >= this.mesh.position.y - 1.0) {
      this._fallSpeed = 0;
      this.mesh.position.y = highestY;
    } else {
      this._fallSpeed = Math.min(this._fallSpeed + 0.008, 0.3);
      this.mesh.position.y -= this._fallSpeed;
    }

    // Filet de sécurité : si le joueur tombe trop bas, on le respawn à la surface
    if (this.mesh.position.y < -10) {
      this.mesh.position.y = 3.0;
      this._fallSpeed = 0;
    }

    // --- 2. Tir Automatique (DESACTIVE) ---
    /*
    let currentTime = window.gameTime;
    if (currentTime - this.lastShootTime >= this.shootCooldown) {
      // Find nearest enemy
      let nearestEnemy = null;
      let minDistance = Infinity;

      for (let enemy of enemies) {
        if (enemy.isDead) continue;
        let distance = BABYLON.Vector3.Distance(
          this.mesh.position,
          enemy.mesh.position,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestEnemy = enemy;
        }
      }

      // Shoot if an enemy is available
      if (nearestEnemy) {
        this.projectiles.push(
          new Projectile(
            this.scene,
            this.mesh.position,
            nearestEnemy,
            this.damage,
          ),
        );
        this.lastShootTime = currentTime;
      }
    }
    */

    // --- 3. Update active projectiles ---
    // Iterate backwards so we can remove safely
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let proj = this.projectiles[i];
      proj.update();
      if (proj.isDestroyed) {
        this.projectiles.splice(i, 1);
      }
    }
  }
}
