import { Projectile } from './Projectile.js';
import { SpellDatabase } from '../configs/SpellDatabase.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.speed = 0.1; 
        this.baseSpeed = 0.1;
        
        // --- Statistiques du joueur ---
        this.maxHp = 100;
        this.hp = 100;
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 10;
        this.attractionRadius = 10;
        this.isDead = false;
        
        // La racine du joueur est maintenant un TransformNode (plus de capsule)
        this.mesh = new BABYLON.TransformNode("player", this.scene);
        this.mesh.position.y = 0; 

        // --- CONFIGURATION COLLISIONS ---
        this.scene.collisionsEnabled = true;
        // Ellipsoïde pour un personnage de ~2m de haut et 1m de large (rayon 0.5)
        // Note: l'ellipsoïde sur un TransformNode nécessite un mesh parent ou d'être appliqué au mesh de base.
        // On va tricher en utilisant un petit mesh invisible pour porter la collision si besoin,
        // mais normalement on peut le mettre sur le root si c'est un AbstractMesh.
        // Ici on va s'assurer que le mesh est un maillage pour moveWithCollisions.
        this.mesh = BABYLON.MeshBuilder.CreateBox("playerProxy", {size: 0.1}, this.scene);
        this.mesh.isVisible = false;
        this.mesh.checkCollisions = true;
        this.mesh.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        this.mesh.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0); 
        this.mesh.position.y = 0; 

        // --- CHARGEMENT DE BRAND PAR DÉFAUT ---
        this.visualMesh = null;
        this.hitbox = null; 
        
        // On attend que les templates soient prêts (normalement chargés dans main.js)
        setTimeout(() => {
            this.setupBrandVisual();
        }, 100);

        // Tir automatique
        this.shootCooldown = 1000; // time in ms between shots
        this.shootCooldown = 1000; // time in ms between shots
        this.baseShootCooldown = 1000;
        this.lastShootTime = 0;
        this.projectiles = [];
        this.damage = 25;
        this.baseDamage = 25;
        this.maxDamage = 75;
        this.maxSpeed = 0.25;
        this.minShootCooldown = 100;

        // --- Système d'Améliorations (Niveaux d'Upgrades) ---
        this.upgradeLevels = {};
        
        // --- Statistiques d'utilisation des éléments (IA Director) ---
        this.elementStats = {
            FIRE: 0,
            ICE: 0,
            EARTH: 0,
            NONE: 0
        };

        // --- Système de Sélection (Level Up) ---
        this.activeCardChoices = [];
        
        this.visualMesh = null; // Gérer le modèle statique

        this.updateUI();
        this.setupUpgrades();
        
        // Raycast utility
        this.downRay = new BABYLON.Ray(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), 10);
    }

    setupBrandVisual() {
        const brandTemplate = window.characterTemplates ? window.characterTemplates['brand'] : null;
        if (!brandTemplate) return;

        // 1. Visuel Normal
        this.visualMesh = brandTemplate.mesh.clone("playerVisual", this.mesh);
        this.visualMesh.setEnabled(true);
        this.visualMesh.isVisible = true;

        // 2. Halo Vert de Collision (Copie de Brand)
        this.hitbox = brandTemplate.mesh.clone("playerHitbox", this.mesh);
        this.hitbox.setEnabled(true);
        
        const haloMat = new BABYLON.StandardMaterial("haloMat", this.scene);
        haloMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
        haloMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        haloMat.alpha = 0.3; // Translucide vert
        
        this.hitbox.getChildMeshes().forEach(m => {
            m.material = haloMat;
            m.isVisible = true;
            m.isPickable = false;
        });

        // Configurer les deux meshes
        [this.visualMesh, this.hitbox].forEach(m => {
            m.scaling = new BABYLON.Vector3(7, 7, 7);
            // On le remonte de 3.5 (la moitié de sa taille à l'échelle) pour que les pieds touchent le sol
            m.position = new BABYLON.Vector3(0, 3.5, 0);
            m.rotation = new BABYLON.Vector3(0, Math.PI, 0);
            m.setEnabled(true);
        });
    }

    changeCharacterMesh(characterData) {
        // ... (cette méthode pourra être mise à jour plus tard, brand est le défaut maintenant)
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
            this.xpToNextLevel = this.level * 10;
            this.hp = this.maxHp; // Heal to full on level up
            
            window.isGamePaused = true;
            this.showLevelUpMenu();
        }
        this.updateUI();
    }

    die() {
        if (this.isDead) return;
        this.isDead = true;
        this.mesh.rotation.x = Math.PI / 2; // Animation de chute

        // Au lieu de Game Over direct, on peut afficher l'écran
        const gameOverScreen = document.getElementById("gameOverScreen");
        if (gameOverScreen) {
            gameOverScreen.classList.remove("hidden");
        }

        // Retour au Hub automatique après un délai si on ne clique pas
        setTimeout(() => {
            if (window.returnToHub) {
                window.returnToHub();
            }
        }, 3000);
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
            const xpPercent = Math.min(100, Math.max(0, (this.xp / this.xpToNextLevel) * 100));
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
        // Ces métriques ajustent les chances de piocher une amélioration :
        const BASE_WEIGHT = 10;        // Poids de base pour qu'une stat apparaisse.
        const LOW_LEVEL_BONUS = 15;    // Énorme bonus pour chaque niveau non amélioré d'une stat. Favorise drastiquement les retards.
        // -----------------------------------------------

        // On initialise les upgrades pour chaque stat
        if (this.upgradeLevels.damage === undefined) this.upgradeLevels.damage = 0;
        if (this.upgradeLevels.speed === undefined) this.upgradeLevels.speed = 0;
        if (this.upgradeLevels.fireRate === undefined) this.upgradeLevels.fireRate = 0;

        let activeSpells = window.activeSpellIds || [];
        activeSpells.forEach(id => {
            if (this.upgradeLevels[id] === undefined) {
                this.upgradeLevels[id] = 0;
                // Sauvegarde le cooldown initial comme référence de base :
                SpellDatabase[id].baseCooldown = SpellDatabase[id].cooldown; 
            }
        });

        let availablePool = [];
        let spellPool = [];

        // Stats Joueur (10 niveaux max par stat)
        if (this.upgradeLevels.damage < 10) {
            availablePool.push({ id: 'damage', type: 'player', weight: BASE_WEIGHT + (10 - this.upgradeLevels.damage) * LOW_LEVEL_BONUS });
        }
        if (this.upgradeLevels.speed < 10) {
            availablePool.push({ id: 'speed', type: 'player', weight: BASE_WEIGHT + (10 - this.upgradeLevels.speed) * LOW_LEVEL_BONUS });
        }
        if (this.upgradeLevels.fireRate < 10) {
            availablePool.push({ id: 'fireRate', type: 'player', weight: BASE_WEIGHT + (10 - this.upgradeLevels.fireRate) * LOW_LEVEL_BONUS });
        }

        // Stats Spells (10 niveaux max pour -60% cooldown)
        activeSpells.forEach(id => {
            if (this.upgradeLevels[id] < 10) {
                spellPool.push({ id: id, type: 'spell', weight: BASE_WEIGHT + (10 - this.upgradeLevels[id]) * LOW_LEVEL_BONUS });
            }
        });

        let selectedUpgrades = [];

        // Helper pour tirer au sort
        const pickRandomWeighted = (pool) => {
            let totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
            let r = Math.random() * totalWeight;
            let current = 0;
            for (let i = 0; i < pool.length; i++) {
                current += pool[i].weight;
                if (r <= current) return pool.splice(i, 1)[0]; 
            }
            return null;
        };

        // REGLE : Forcer au moins 1 Spell disponible
        if (spellPool.length > 0) {
            selectedUpgrades.push(pickRandomWeighted(spellPool));
        }

        // REGLE : Tirer les autres
        let combinedPool = availablePool.concat(spellPool);
        while (selectedUpgrades.length < 3 && combinedPool.length > 0) {
            selectedUpgrades.push(pickRandomWeighted(combinedPool));
        }

        // On mélange visuellement l'ordre des boutons
        selectedUpgrades.sort(() => Math.random() - 0.5);

        const closeAndResume = () => {
            levelUpScreen.classList.add("hidden");
            window.isGamePaused = false;
        };

        // On réinitialise les événements de sélection pour les cartes
        this.activeCardChoices = [];

        // Configurer les 3 cartes
        const cardIds = ["card1", "card2", "card3"];
        cardIds.forEach((id, index) => {
            const cardEl = document.getElementById(id);
            if (!cardEl) return;

            if (index < selectedUpgrades.length) {
                cardEl.style.visibility = "visible";
                const upg = selectedUpgrades[index];
                
                const titleEl = cardEl.querySelector('.card-title');
                const descEl = cardEl.querySelector('.card-description');
                
                let title = "";
                let description = "";
                let action = null;

                if (upg.type === 'player') {
                    if (upg.id === 'damage') {
                        let step = (this.maxDamage - this.baseDamage) / 10;
                        let next = Math.min(this.maxDamage, this.damage + step);
                        title = "Force Occulte";
                        description = `Augmente vos dégâts de base.<br><s>${this.damage.toFixed(1)}</s> ➔ ${next.toFixed(1)}`;
                        action = () => { this.damage = next; this.upgradeLevels.damage++; closeAndResume(); };
                    }
                    else if (upg.id === 'speed') {
                        let step = (this.maxSpeed - this.baseSpeed) / 10;
                        let next = Math.min(this.maxSpeed, this.speed + step);
                        title = "Bottes de Célérité";
                        description = `Augmente la vitesse de mouvement.<br><s>${(this.speed * 100).toFixed(0)}</s> ➔ ${(next * 100).toFixed(0)}`;
                        action = () => { this.speed = next; this.upgradeLevels.speed++; closeAndResume(); };
                    }
                    else if (upg.id === 'fireRate') {
                        let step = (this.minShootCooldown - this.baseShootCooldown) / 10;
                        let next = Math.max(this.minShootCooldown, this.shootCooldown + step);
                        title = "Cadence Arcanique";
                        description = `Réduit le délai entre les tirs automatiques.<br><s>${Math.round(this.shootCooldown)}ms</s> ➔ ${Math.round(next)}ms`;
                        action = () => { this.shootCooldown = next; this.upgradeLevels.fireRate++; closeAndResume(); };
                    }
                } else if (upg.type === 'spell') {
                    const spell = SpellDatabase[upg.id];
                    let reduction = (this.upgradeLevels[upg.id] + 1) * 0.06; 
                    let nextCd = spell.baseCooldown * (1 - reduction);
                    title = spell.name;
                    description = `Réduit le temps de recharge du sort.<br><s>${spell.cooldown.toFixed(1)}s</s> ➔ ${nextCd.toFixed(1)}s`;
                    action = () => { 
                        spell.cooldown = nextCd; 
                        this.upgradeLevels[upg.id]++; 
                        closeAndResume(); 
                    };
                }

                if (titleEl) titleEl.innerHTML = title;
                if (descEl) descEl.innerHTML = description;
                
                // --- AJOUT CLIC SOURIS (DEBUG/ACCESSIBILITÉ) ---
                // On clone pour éviter les doublons d'events si on level up plusieurs fois
                const newCard = cardEl.cloneNode(true);
                cardEl.parentNode.replaceChild(newCard, cardEl);
                newCard.addEventListener('click', () => {
                    console.log("[PLAYER] Upgrade sélectionnée par Clic Souris !");
                    if (action) action();
                });

                // On stocke le callback et l'élément pour la détection de survol/geste
                this.activeCardChoices.push({ element: newCard, action: action });
            } else {
                cardEl.style.visibility = "hidden";
            }
        });

        levelUpScreen.classList.remove("hidden");
    }

    handleLevelUpInteraction(cursorX, cursorY) {
        if (!this.activeCardChoices || this.activeCardChoices.length === 0) return;

        this.activeCardChoices.forEach(choice => {
            const rect = choice.element.getBoundingClientRect();
            const wasHovered = choice.element.classList.contains("hovered");
            const isHoveredNow = (
                cursorX >= rect.left && 
                cursorX <= rect.right && 
                cursorY >= rect.top && 
                cursorY <= rect.bottom
            );

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

    /**
     * Vérifie si un point (et son périmètre de 0.5m) touche un danger (lave ou trou).
     * @returns true si un danger est détecté sous les pieds.
     */
    checkHazardAt(position) {
        // Points à vérifier : Centre + 4 points cardinaux (périmètre de 0.5m)
        const offsets = [
            new BABYLON.Vector3(0, 0, 0),
            new BABYLON.Vector3(0.5, 0, 0),
            new BABYLON.Vector3(-0.5, 0, 0),
            new BABYLON.Vector3(0, 0, 0.5),
            new BABYLON.Vector3(0, 0, -0.5)
        ];

        for (let offset of offsets) {
            const checkPos = position.add(offset);
            // On part d'un peu plus haut (Y+2) pour être sûr de traverser le sol
            const ray = new BABYLON.Ray(new BABYLON.Vector3(checkPos.x, checkPos.y + 2, checkPos.z), new BABYLON.Vector3(0, -1, 0), 10);

            const hit = this.scene.pickWithRay(ray, (mesh) => {
                // IGNORER les objets désactivés (important pour le passage HUB/NIVEAU)
                if (!mesh.isEnabled()) return false;

                // CRUCIAL : Ignorer le joueur lui-même et ses enfants visuels
                if (mesh === this.mesh || mesh.name.toLowerCase().includes("player") || mesh.name.toLowerCase().includes("brand")) return false;
                
                // On peut aussi ignorer les projectiles
                if (mesh.name.toLowerCase().includes("projectile")) return false;
                
                return true; 
            });

            if (hit.hit && hit.pickedMesh) {
                const meshName = hit.pickedMesh.name.toLowerCase();
                const sourceName = hit.pickedMesh.sourceMesh ? hit.pickedMesh.sourceMesh.name.toLowerCase() : "";
                
                // Si l'un des noms contient "lava", "pit" ou "trou", on bloque
                if (meshName.includes("lava") || sourceName.includes("lava") || 
                    meshName.includes("pit") || meshName.includes("trou")) {
                    console.log(`[DEBUG] Blocage détecté sur mesh : ${meshName} (Source: ${sourceName}) à la position :`, checkPos);
                    return true; 
                }
            }
        }
        return false;
    }

    checkTerrain() {
        // On conserve cette méthode pour les effets secondaires (vitesse, dégâts)
        // si jamais le joueur se retrouve coincé dans la lave pour une raison X
        const onHazard = this.checkHazardAt(this.mesh.position);
        
        if (onHazard) {
            this.speed = this.baseSpeed * 0.4;
            if (window.gameTime % 60 < 2) { 
                this.takeDamage(0.2); 
            }
        } else {
            this.speed = this.baseSpeed;
        }
    }

    update(inputManager, enemies = []) {
        if (this.isDead) return;

        // Protection anti-chute (si bug de collision)
        if (this.mesh.position.y < -5) {
            this.mesh.position.y = 1.0;
            console.warn("[PLAYER] Chute détectée, remise à la surface.");
        }

        // --- 0. Vérification du terrain ---
        this.checkTerrain();

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

        if (inputManager.isKeyPressed('KeyW')) zInput += 1;
        if (inputManager.isKeyPressed('KeyS')) zInput -= 1;
        if (inputManager.isKeyPressed('KeyA')) xInput -= 1;
        if (inputManager.isKeyPressed('KeyD')) xInput += 1;

        // 4. On combine les directions de la caméra avec nos inputs
        // Ex: Si zInput vaut 1, on ajoute un vecteur "Avant".
        let moveDirection = camForward.scale(zInput).add(camRight.scale(xInput));

        // 5. On normalise pour les déplacements en diagonale
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }

        // 6. Décomposition du mouvement pour permettre la "glissade" le long des obstacles
        const dX = moveDirection.x * this.speed;
        const dZ = moveDirection.z * this.speed;

        // --- MOUVEMENT SUR L'AXE X ---
        if (Math.abs(dX) > 0.0001) {
            const oldPos = this.mesh.position.clone();
            this.mesh.moveWithCollisions(new BABYLON.Vector3(dX, 0, 0));
            if (this.checkHazardAt(this.mesh.position)) {
                this.mesh.position.copyFrom(oldPos);
            }
        }

        // --- MOUVEMENT SUR L'AXE Z ---
        if (Math.abs(dZ) > 0.0001) {
            const oldPos = this.mesh.position.clone();
            this.mesh.moveWithCollisions(new BABYLON.Vector3(0, 0, dZ));
            if (this.checkHazardAt(this.mesh.position)) {
                this.mesh.position.copyFrom(oldPos);
            }
        }

        // --- GRAVITÉ (Axe Y) ---
        // Toujours essayer de descendre un peu pour rester collé au sol
        this.mesh.moveWithCollisions(new BABYLON.Vector3(0, -0.05, 0));

        // --- 2. Tir Automatique ---
        let currentTime = window.gameTime;
        if (currentTime - this.lastShootTime >= this.shootCooldown) {
            // Find nearest enemy
            let nearestEnemy = null;
            let minDistance = Infinity;

            for (let enemy of enemies) {
                if (enemy.isDead) continue;
                let distance = BABYLON.Vector3.Distance(this.mesh.position, enemy.mesh.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = enemy;
                }
            }

            // Shoot if an enemy is available
            if (nearestEnemy) {
                this.projectiles.push(new Projectile(this.scene, this.mesh.position, nearestEnemy, this.damage));
                this.lastShootTime = currentTime;
            }
        }

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