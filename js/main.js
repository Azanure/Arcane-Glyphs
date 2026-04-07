/**
 * Point d'entrée principal unifié - Arcane Glyphs
 * Combine Menu Voxel, Tracking MediaPipe, et Architecture Gameplay.
 */

// Imports de l'architecture Gameplay
import { Environment } from './level/Environment.js';
import { Player } from './entities/Player.js';
import { CameraManager } from './managers/CameraManager.js';
import { InputManager } from './managers/InputManager.js';
import { FireEnemy, IceEnemy, EarthEnemy } from './entities/ElementalEnemies.js';
import { XpOrb } from './entities/XpOrb.js';
import { SpellManager } from './managers/SpellManager.js';
import { SpellDatabase } from './configs/SpellDatabase.js';
import { WaveManager } from './managers/WaveManager.js';

// Imports de l'interface tracking et menu global
import { initTracking, startShapeDetection } from './tracking.js';
import { initMenu } from './menu.js';

// --- ÉTATS DU JEU ---
const GameState = {
    MENU: 0,
    HUB: 1,
    LEVEL: 2
};
let currentState = GameState.MENU;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Éléments du DOM (Tracking & UI Globale)
    const renderCanvas = document.getElementById('renderCanvas');
    const drawingCanvas = document.getElementById('drawingCanvas');
    const videoElement = document.getElementById('videoElement');
    const magicCursor = document.getElementById('magicCursor');
    
    // Éléments du HUD et de Sélection des Sorts
    const uiContainer = document.getElementById('uiContainer');
    const hudSpells = document.getElementById('hudSpells');
    const spellSelectionScreen = document.getElementById('spellSelectionScreen');
    const spellBank = document.getElementById('spellBank');
    
    // 2. Initialisation du moteur Babylon.js
    const engine = new BABYLON.Engine(renderCanvas, true);
    const scene = new BABYLON.Scene(engine);

    // --- CHARGEMENT DES ASSETS ---
    window.enemyTemplates = {};
    async function loadAssets() {
        try {
            // 1. Modèle Course
            const resRun = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/Animations/", "Slow Run.glb", scene);
            resRun.meshes[0].setEnabled(false);
            window.enemyTemplates['fire_run'] = { mesh: resRun.meshes[0], animationGroups: resRun.animationGroups };
            
            // 2. Modèle Attaque
            const resAtk = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/Animations/", "Attack.glb", scene);
            resAtk.meshes[0].setEnabled(false);
            window.enemyTemplates['fire_attack'] = { mesh: resAtk.meshes[0], animationGroups: resAtk.animationGroups };

            // Nettoyage Root Motion sur les deux (In-Place)
            [window.enemyTemplates['fire_run'], window.enemyTemplates['fire_attack']].forEach(template => {
                template.animationGroups.forEach(ag => {
                    ag.targetedAnimations.forEach(ta => {
                        if (ta.animation.targetProperty === "position") {
                            const keys = ta.animation.getKeys();
                            keys.forEach(k => { k.value.x = 0; k.value.z = 0; });
                        }
                    });
                });
            });

            console.log("[ASSETS] Modèles de course et d'attaque chargés avec succès.");
        } catch (e) {
            console.error("[ASSETS] Erreur lors du chargement des animations", e);
        }
    }
    await loadAssets();

    // Initialisation des systèmes de Gameplay
    const environment = new Environment(scene);
    const player = new Player(scene);
    const cameraManager = new CameraManager(scene);
    const spellManager = new SpellManager(scene);
    const waveManager = new WaveManager();
    const inputManager = new InputManager();

    cameraManager.setTarget(player.mesh);

    // Entités Actives
    let enemies = [];
    let xpOrbs = [];
    let lastSpawnTime = 0;
    const enemySpawnRate = 2000;

    window.gameTime = 0;
    let lastRealTime = performance.now();
    window.isGamePaused = true;

    // --- MISE EN PLACE DU HUB ---
    // Le "Portail" pour lancer le niveau
    const portal = BABYLON.MeshBuilder.CreateCylinder("portal", {height: 4, diameter: 3}, scene);
    portal.position = new BABYLON.Vector3(0, 2, 15);
    const portalMat = new BABYLON.StandardMaterial("portalMat", scene);
    portalMat.emissiveColor = new BABYLON.Color3(0, 0.5, 1);
    portalMat.alpha = 0.7;
    portal.material = portalMat;

    // L'"Autel" pour choisir les sorts
    const spellAltar = BABYLON.MeshBuilder.CreateBox("altar", {size: 3}, scene);
    spellAltar.position = new BABYLON.Vector3(15, 1.5, 0);
    const altarMat = new BABYLON.StandardMaterial("altarMat", scene);
    altarMat.emissiveColor = new BABYLON.Color3(0.8, 0.2, 0.8);
    spellAltar.material = altarMat;

    // --- LOGIQUE DE GESTION DES SORTS DRAG & DROP ---
    const slots = {
        'CERCLE': document.getElementById('slot-cercle'),
        'LIGNE':  document.getElementById('slot-ligne'),
        'TRIANGLE': document.getElementById('slot-triangle')
    };
    
    const hudSlots = {
        'CERCLE': document.getElementById('hud-cercle'),
        'LIGNE':  document.getElementById('hud-ligne'),
        'TRIANGLE': document.getElementById('hud-triangle')
    };

    // Remplir la banque de sorts disponible
    spellBank.innerHTML = ''; // Nettoyer
    Object.values(SpellDatabase).forEach(spell => {
        const spellEl = document.createElement('div');
        spellEl.className = 'spell-item';
        spellEl.draggable = true;
        spellEl.dataset.spellId = spell.id;
        spellEl.innerText = spell.name;
        
        spellEl.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', spell.id);
        });
        spellBank.appendChild(spellEl);
    });

    // Configuration des slots pour le Drop
    Object.values(slots).forEach(slot => {
        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('drop', e => {
            e.preventDefault();
            if (slot.children.length > 0) return; // Un seul sort par slot
            
            const spellId = e.dataTransfer.getData('text/plain');
            if (!spellId) return;
            const draggedEl = document.querySelector(`.spell-item[data-spell-id="${spellId}"]`);
            if (draggedEl) {
                const clone = draggedEl.cloneNode(true);
                clone.draggable = true;
                clone.addEventListener('dragstart', dragEvent => {
                    dragEvent.dataTransfer.setData('text/plain', spellId);
                    setTimeout(() => clone.remove(), 0);
                    updateActiveBindings();
                });
                slot.appendChild(clone);
                updateActiveBindings();
            }
        });
    });
    
    spellBank.addEventListener('dragover', e => e.preventDefault());
    spellBank.addEventListener('drop', e => e.preventDefault()); // Autorise de jeter un sort du slot

    let activeBindings = []; // Ex: [{ shape: 'CERCLE', spellCode: SpellDatabase.FIREBALL }, ...]

    function updateActiveBindings() {
        activeBindings = [];
        Object.keys(slots).forEach(shapeKey => {
            const slot = slots[shapeKey];
            if (slot.children.length > 0) {
                const spellId = slot.children[0].dataset.spellId;
                const spellCode = Object.values(SpellDatabase).find(s => s.id === spellId);
                activeBindings.push({ shape: shapeKey, spellCode });

                // Update HUD Name
                const nameEl = hudSlots[shapeKey].querySelector('.hud-spell-name');
                if (nameEl) nameEl.innerText = spellCode.name;
            } else {
                // Clear HUD Name if slot is empty
                const nameEl = hudSlots[shapeKey].querySelector('.hud-spell-name');
                if (nameEl) nameEl.innerText = '';
            }
        });
        window.activeSpellIds = activeBindings.map(b => b.spellCode.id);
    }

    // --- INTEGRATION DU TRACKING ET DU CAST DE SORT ---
    // Cette fonction sera appelée par tracking.js quand une forme est reconnue
    window.onShapeDetected = (detectedShape) => {
        if (currentState !== GameState.LEVEL) return; // On ne cast que dans le niveau

        console.log(`[MAGIC] Forme détectée : ${detectedShape}`);
        
        // Chercher si un sort est lié à cette forme
        const binding = activeBindings.find(b => b.shape === detectedShape);
        if (binding) {
            // Lancer le calcul de cast depuis le manager
            let lastTime = spellManager.cooldowns[binding.spellCode.id] || 0;
            let cooldownMs = binding.spellCode.cooldown * 1000;
            
            if (window.gameTime - lastTime >= cooldownMs) {
                spellManager.castSpell(binding.spellCode, player, enemies);
                spellManager.cooldowns[binding.spellCode.id] = window.gameTime;
                console.log(`[MAGIC] Sort ${binding.spellCode.name} lancé !`);
            } else {
                console.log(`[MAGIC] Sort en Cooldown.`);
            }
        }
    };


    // 3. Initialisation du Menu Principal
    initMenu();

    // 4. Initialisation du Tracking (MediaPipe)
    initTracking(videoElement, drawingCanvas, magicCursor);

    function resizeDrawingCanvas() {
        if (drawingCanvas) {
            drawingCanvas.width = window.innerWidth;
            drawingCanvas.height = window.innerHeight;
        }
    }
    window.addEventListener('resize', () => {
        engine.resize();
        resizeDrawingCanvas();
    });
    resizeDrawingCanvas();

    // 5. Raccourci pour l'Inspecteur Babylon.js (Touche "i")
    window.addEventListener("keydown", (ev) => {
        if (ev.key.toLowerCase() === 'i') {
            if (scene.debugLayer.isVisible()) {
                scene.debugLayer.hide();
            } else {
                scene.debugLayer.show({ embedMode: false, handleResize: true, enablePopup: true });
            }
        }
    });

    /**
     * LOGIQUE DE LANCEMENT DU JEU
     */
    window.onGameStart = (isContinue) => {
        console.log(`[MAIN] Démarrage du jeu en mode HUB.`);
        currentState = GameState.HUB;
        window.isGamePaused = false;
        
        // On affiche les HUD virtuels (vides pour l'instant)
        uiContainer.classList.remove("hidden");
        hudSpells.classList.remove("hidden");
    };

    /**
     * TRANSITION HUB -> LEVEL
     */
    function startLevel() {
        console.log(`[MAIN] Passage en mode COMBAT (Level)`);
        currentState = GameState.LEVEL;
        
        // On cache le HUB physique
        portal.isVisible = false;
        spellAltar.isVisible = false;
        
        // Reset player au centre
        player.mesh.position = BABYLON.Vector3.Zero();

        // On avertit le système de reconnaissance de commencer à écouter les tracés
        startShapeDetection(); 
    }

    /**
     * RETOUR AU HUB (Mort ou Sortie)
     */
    window.returnToHub = () => {
        console.log("[MAIN] Retour au HUB (Échec ou Réinitialisation)");
        currentState = GameState.HUB;
        
        // Réinitialiser le Joueur
        player.isDead = false;
        player.hp = player.maxHp;
        player.mesh.position = BABYLON.Vector3.Zero();
        player.mesh.rotation.x = 0; // Se relever si besoin
        player.updateUI();

        // Nettoyer les Entités
        enemies.forEach(e => e.mesh.dispose());
        enemies = [];
        xpOrbs.forEach(o => o.mesh.dispose());
        xpOrbs = [];

        // Ré-afficher le HUB physique
        portal.isVisible = true;
        spellAltar.isVisible = true;

        // Cacher les écrans de fin si présent
        document.getElementById("gameOverScreen").style.display = "none";
    };


    // 6. LA BOUCLE DE GAMEPLAY UNIFIÉE
    engine.runRenderLoop(() => {
        let currentRealTime = performance.now();
        let dt = currentRealTime - lastRealTime;
        lastRealTime = currentRealTime;

        if (!window.isGamePaused && currentState !== GameState.MENU) {
            window.gameTime += dt;
        }
        
        // --- INTERACTION UI (LEVEL UP) ---
        if (window.isGamePaused && currentState === GameState.LEVEL) {
            if (typeof window.smoothedCursorX !== 'undefined') {
                player.handleLevelUpInteraction(window.smoothedCursorX, window.smoothedCursorY);
            }
        }
        
        let currentTime = window.gameTime;

        if (currentState === GameState.HUB) {
            // Mettre à jour les contrôles basiques
            player.update(inputManager, []);
            cameraManager.update();

            portal.rotation.y += 0.02;

            // Détection de proximité Portal -> Lance le niveau
            if (BABYLON.Vector3.Distance(player.mesh.position, portal.position) < 2.5) {
                startLevel();
            }

            // Détection de proximité Autel -> Affiche UI Sorts
            if (BABYLON.Vector3.Distance(player.mesh.position, spellAltar.position) < 4) {
               if(spellSelectionScreen.classList.contains("hidden")) {
                   spellSelectionScreen.classList.remove("hidden");
               }
            } else {
               if(!spellSelectionScreen.classList.contains("hidden")) {
                   spellSelectionScreen.classList.add("hidden");
               }
            }
        }

        if (currentState === GameState.LEVEL && !window.isGamePaused) {
            // Spawn enemies
            if (currentTime - lastSpawnTime >= enemySpawnRate) {
                let spawnDistance = 20 + Math.random() * 10;
                let enemyType = waveManager.spawnEnemy(player);
                
                let newEnemy;
                if (enemyType === 'FIRE') newEnemy = new FireEnemy(scene, player.mesh.position, spawnDistance);
                else if (enemyType === 'ICE') newEnemy = new IceEnemy(scene, player.mesh.position, spawnDistance);
                else newEnemy = new EarthEnemy(scene, player.mesh.position, spawnDistance);
                
                enemies.push(newEnemy);
                lastSpawnTime = currentTime;
            }

            // Update enemies
            for (let i = enemies.length - 1; i >= 0; i--) {
                let enemy = enemies[i];
                enemy.update(player, enemies);
                if (enemy.isDead) {
                    if (enemy.deathPosition) {
                        xpOrbs.push(new XpOrb(scene, enemy.deathPosition, enemy.experienceValue));
                    }
                    enemies.splice(i, 1);
                }
            }

            // Update XP Orbs
            for (let i = xpOrbs.length - 1; i >= 0; i--) {
                let orb = xpOrbs[i];
                orb.update(player);
                if (orb.isDestroyed) {
                    xpOrbs.splice(i, 1);
                }
            }

            player.update(inputManager, enemies);
            // On ne bind plus de sort avec le clavier, c'est le tracking qui cast
            // On appelle juste update du spellManager pour les particules etc
            spellManager.update(inputManager, player, enemies); 
            cameraManager.update();

            // AI Probabilities UI Update
            const probs = waveManager.getSpawnProbabilities(player);
            const pctFire = Math.round((probs.FIRE / probs.totalWeight) * 100);
            const pctIce = Math.round((probs.ICE / probs.totalWeight) * 100);
            const pctEarth = Math.round((probs.EARTH / probs.totalWeight) * 100);

            const elFire = document.getElementById("probFire");
            const elIce = document.getElementById("probIce");
            const elEarth = document.getElementById("probEarth");
            
            if (elFire) elFire.innerText = `Fire: ${pctFire}%`;
            if (elIce) elIce.innerText = `Ice: ${pctIce}%`;
            if (elEarth) elEarth.innerText = `Earth: ${pctEarth}%`;
        }

        // UPDATE COOLDOWNS HUD GLOBAL (HUB & LEVEL)
        if(currentState !== GameState.MENU) {
            activeBindings.forEach(binding => {
                const shape = binding.shape;
                const spellId = binding.spellCode.id;
                
                const cooldownMs = binding.spellCode.cooldown * 1000;
                const lastTime = spellManager.cooldowns[spellId] || -999999;
                const elapsed = currentTime - lastTime;
                
                let angle = 0;
                if (elapsed < cooldownMs) {
                    const progress = elapsed / cooldownMs;
                    // L'aiguille tourne de 0 à 360 pendant la recharge
                    angle = progress * 360;
                } else {
                    angle = 0; // Pointe vers le haut quand prêt
                }
                
                const needle = hudSlots[shape].querySelector('.hud-needle');
                if (needle) {
                    needle.style.transform = `rotate(${angle}deg)`;
                }
            });
        }
        
        scene.render();
    });

    console.log("Arcane Glyphs : Architecture Gameplay Intégrée !");
});
