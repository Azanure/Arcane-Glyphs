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
        
        this.mesh = BABYLON.MeshBuilder.CreateCapsule("player", {height: 2, radius: 0.5}, this.scene);
        this.mesh.position.y = 1; 

        const mat = new BABYLON.StandardMaterial("playerMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0, 0.7, 1);
        this.mesh.material = mat;
        
        // --- HITBOX JOUEUR ---
        this.hitbox = BABYLON.MeshBuilder.CreateBox("playerHitbox", {size: 1.5}, scene);
        this.hitbox.parent = this.mesh;
        this.hitbox.position.y = 1; // Centré sur le corps
        this.hitbox.isPickable = false;
        
        // Style Debug Hitbox (Semi-transparent)
        const hitboxMat = new BABYLON.StandardMaterial("hitboxMat", scene);
        hitboxMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
        hitboxMat.alpha = 0.2; // Très discret
        this.hitbox.material = hitboxMat;
 

        // Tir automatique
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
        
        this.updateUI();
        this.setupUpgrades();
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
                
                // On stocke le callback et l'élément pour la détection de survol/geste
                this.activeCardChoices.push({ element: cardEl, action: action });
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

    update(inputManager, enemies = []) {
        if (this.isDead) return;

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

        // 6. On applique enfin le mouvement au joueur
        this.mesh.position.x += moveDirection.x * this.speed;
        this.mesh.position.z += moveDirection.z * this.speed;

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