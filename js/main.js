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
import { CharacterCarouselManager } from './managers/CharacterCarouselManager.js';

// Imports de l'interface tracking et menu global
import { initTracking, startShapeDetection } from './tracking.js';
import { initMenu } from './menu.js';
import { LoadoutUI } from './ui/LoadoutUI.js';

// --- ÉTATS DU JEU ---
const GameState = {
    MENU: 0,
    HUB: 1,
    LEVEL: 2,
    CHARACTER_SELECTION: 3
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
    
    // Initialisation de la vue Loadout
    const loadoutUI = new LoadoutUI();
    
    // UI du Carousel de personnages
    const characterSelectionScreen = document.getElementById('characterSelectionScreen');
    const carouselUI = {
        charName: document.getElementById('carouselCharName'),
        charClass: document.getElementById('carouselCharClass'),
        btnPrev: document.getElementById('btnPrevChar'),
        btnNext: document.getElementById('btnNextChar'),
        statForce: document.getElementById('statForce'),
        statVitesse: document.getElementById('statVitesse'),
        statMagie: document.getElementById('statMagie'),
        lockBanner: document.getElementById('carouselLockBanner'),
        lockCondition: document.getElementById('carouselLockCondition'),
        btnPlay: document.getElementById('btnPlayCharacter'),
        btnQuit: document.getElementById('btnQuitCarousel')
    };
    
    // 2. Initialisation du moteur Babylon.js
    const engine = new BABYLON.Engine(renderCanvas, true);
    const scene = new BABYLON.Scene(engine);

    // --- CHARGEMENT DES ASSETS ---
    window.enemyTemplates = {};
    window.characterTemplates = {};
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

            // 3. Modèles de personnages
            const charNames = ['azir', 'brand', 'kayle', 'tung tung', 'xerath'];
            for (let name of charNames) {
                try {
                    const resChar = await BABYLON.SceneLoader.ImportMeshAsync("", `assets/characters/player/${name}/`, `${name}.glb`, scene);
                    resChar.meshes[0].setEnabled(false);
                    // Stocker le template
                    window.characterTemplates[name] = { mesh: resChar.meshes[0], animationGroups: resChar.animationGroups };
                } catch(err) {
                    console.log(`[ASSETS] Impossible de charger le personnage : ${name}`, err);
                }
            }

            console.log("[ASSETS] Modèles de course, d'attaque et de personnages chargés avec succès.");
        } catch (e) {
            console.error("[ASSETS] Erreur lors du chargement des animations", e);
        }
    }
    await loadAssets();

    // Initialisation des systèmes de Gameplay
    const environment = new Environment(scene);
    await environment.init();
    
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
    window.enemiesEnabled = false; // Désactivé par défaut pour le debug

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

    // L'"Autel" pour les personnages
    const characterAltar = BABYLON.MeshBuilder.CreateCylinder("charAltar", {height: 1, diameter: 4}, scene);
    characterAltar.position = new BABYLON.Vector3(-15, 0.5, 0);
    const charAltarMat = new BABYLON.StandardMaterial("charAltarMat", scene);
    charAltarMat.emissiveColor = new BABYLON.Color3(1, 0.84, 0); // Gold
    characterAltar.material = charAltarMat;

    // Configuration Manager du Carrousel
    const playCallback = (selectedCharacter) => {
        // Retourner au HUB state, cacher l'UI
        characterSelectionScreen.classList.add('hidden');
        currentState = GameState.HUB;
        
        // Cacher le carrousel
        carouselManager.setVisible(false);
        
        // Montrer le HUB
        portal.isVisible = true;
        spellAltar.isVisible = true;
        characterAltar.isVisible = true;

        // Montrer le menu des sorts
        hudSpells.classList.remove("hidden");

        // Assigner le visuel
        player.changeCharacterMesh(selectedCharacter);
        
        // Repositionner la caméra en mode normal
        cameraManager.setTarget(player.mesh);
    };

    const carouselManager = new CharacterCarouselManager(scene, carouselUI, playCallback);
    
    // Définir les 5 personnages
    const charsData = [
        { name: "Azir", className: "Empereur des Sables", modelName: "azir", unlocked: true, stats: { force: 30, vitesse: 60, magie: 90 } },
        { name: "Brand", className: "Vengeur Flamboyant", modelName: "brand", unlocked: true, stats: { force: 20, vitesse: 40, magie: 100 } },
        { name: "Kayle", className: "Justicière Céleste", modelName: "kayle", unlocked: false, unlockCondition: "Atteindre la Vague 10", stats: { force: 80, vitesse: 70, magie: 80 } },
        { name: "Tung Tung", className: "Moine Aveugle", modelName: "tung tung", unlocked: false, unlockCondition: "Vaincre 1000 ennemis", stats: { force: 95, vitesse: 90, magie: 20 } },
        { name: "Xerath", className: "Mage Ascendant", modelName: "xerath", unlocked: false, unlockCondition: "Trouver le Glyphe Perdu", stats: { force: 10, vitesse: 30, magie: 100 } }
    ];
    carouselManager.initCharacters(charsData, window.characterTemplates);
    carouselManager.setVisible(false); // Cacher au départ

    // Binding pour quitter le carrousel
    carouselUI.btnQuit.addEventListener('click', () => {
        if(carouselManager.isAnimating) return;
        characterSelectionScreen.classList.add('hidden');
        currentState = GameState.HUB;
        carouselManager.setVisible(false);
        portal.isVisible = true;
        spellAltar.isVisible = true;
        characterAltar.isVisible = true;
        hudSpells.classList.remove("hidden");
        cameraManager.setTarget(player.mesh);
    });

    // On met à jour l'affichage en bas de l'écran avec les données du LoadoutManager
    function updateActiveBindings() {
        const loadout = window.loadoutManager.getLoadout(); // On y a accès via module ou window
        window.activeSpellIds = [];

        ['CERCLE', 'LIGNE', 'TRIANGLE'].forEach(shapeKey => {
            const spell = loadout.bindings[shapeKey];
            const hudSlot = document.getElementById(`hud-${shapeKey.toLowerCase()}`);
            if (!hudSlot) return;

            const nameEl = hudSlot.querySelector('.hud-spell-name');
            if (spell) {
                window.activeSpellIds.push(spell.id);
                nameEl.innerText = spell.name;
                hudSlot.style.color = window.ElementDatabase[spell.element]?.color || '#fff';
            } else {
                nameEl.innerText = '';
                hudSlot.style.color = '';
            }
        });
    }

    // Export pour LoadoutUI ou tracking :
    window.updateActiveBindingsHub = updateActiveBindings;

    // --- INTEGRATION DU TRACKING ET DU CAST DE SORT ---
    // Cette fonction sera appelée par tracking.js quand une forme est reconnue
    window.onShapeDetected = (detectedShape) => {
        // Autorise le cast si on est dans un niveau OU si on est dans le HUB en mode Debug
        const isAllowedState = currentState === GameState.LEVEL || (currentState === GameState.HUB && window.isDebugMouseMode);
        
        if (!isAllowedState) {
            console.log(`[MAGIC] Détection ignorée : état de jeu incompatible (${currentState}).`);
            return;
        }

        console.log(`[MAGIC] Forme détectée : ${detectedShape}`);
        
        // Obtenir le loadout
        const loadout = window.loadoutManager.getLoadout();
        const spell = loadout.bindings[detectedShape];
        
        if (spell) {
            // Lancer le calcul de cast depuis le manager
            let lastTime = spellManager.cooldowns[spell.id] || 0;
            let cooldownMs = spell.cooldown * 1000;
            
            if (window.gameTime - lastTime >= cooldownMs) {
                spellManager.castSpell(spell, player, enemies);
                spellManager.cooldowns[spell.id] = window.gameTime;
                console.log(`[MAGIC] Sort ${spell.name} lancé !`);
            } else {
                console.log(`[MAGIC] Sort en Cooldown.`);
            }
        }
    };


    // 3. Initialisation du Menu Principal
    initMenu();

    // 4. Initialisation du Tracking (MediaPipe)
    initTracking(videoElement, drawingCanvas, magicCursor);
    startShapeDetection(); // Toujours actif pour permettre le debug / HUB interaction

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
        uiContainer.classList.add("hidden"); // Cacher HP/XP dans le HUB
        hudSpells.classList.remove("hidden"); // Garder les sorts visibles
    };

    /**
     * TRANSITION HUB -> LEVEL
     */
    function startLevel() {
        console.log(`[MAIN] Passage en mode COMBAT (Level)`);
        currentState = GameState.LEVEL;
        
        // Mode Environnement Level
        environment.setMode('LEVEL');
        
        // On cache le HUB physique
        portal.isVisible = false;
        spellAltar.isVisible = false;
        characterAltar.isVisible = false;
        
        // On affiche le HUD de combat
        uiContainer.classList.remove("hidden");
        
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
        
        // Mode Environnement HUB (Plateforme verte)
        environment.setMode('HUB');
        
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
        
        // Cacher le HUD de combat
        uiContainer.classList.add("hidden");
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
               if(loadoutUI.domElements.screen.classList.contains("hidden")) {
                   loadoutUI.show();
               }
            } else {
               if(!loadoutUI.domElements.screen.classList.contains("hidden")) {
                   loadoutUI.hide();
               }
            }

            // Détection de proximité Character Altar -> Lance la UI de Selection
            if (BABYLON.Vector3.Distance(player.mesh.position, characterAltar.position) < 3) {
                console.log("[MAIN] Entrée dans la Sélection de Personnage");
                currentState = GameState.CHARACTER_SELECTION;
                
                // Cacher les autres UI et le monde
                loadoutUI.hide();
                hudSpells.classList.add('hidden'); // Cacher la barre du bas
                portal.isVisible = false;
                spellAltar.isVisible = false;
                characterAltar.isVisible = false;
                
                // Préparer la caméra pour une vue de face (POV)
                scene.activeCamera.lockedTarget = null;
                
                // On positionne la caméra bien en face du slot central (situé à z=4)
                scene.activeCamera.position = new BABYLON.Vector3(0, 2.5, 12); 
                scene.activeCamera.setTarget(new BABYLON.Vector3(0, 2.5, 4));
                
                carouselManager.setVisible(true);
                characterSelectionScreen.classList.remove("hidden");
                
                // On déplace le joueur pour ne pas qu'il gêne
                player.mesh.position.copyFrom(new BABYLON.Vector3(-10, 0, 0)); 
            }
        }
        
        if (currentState === GameState.CHARACTER_SELECTION) {
            // Dans ce state, on peut écouter les touches clavier Left/Right si besoin
            if (inputManager.isKeyPressed('ArrowLeft') || inputManager.isKeyPressed('KeyA')) {
                // Pour éviter le spam frame par frame :
                if(!carouselManager._leftPressed) {
                    carouselManager.rotateCarousel(-1);
                    carouselManager._leftPressed = true;
                }
            } else {
                carouselManager._leftPressed = false;
            }
            
            if (inputManager.isKeyPressed('ArrowRight') || inputManager.isKeyPressed('KeyD')) {
                if(!carouselManager._rightPressed) {
                    carouselManager.rotateCarousel(1);
                    carouselManager._rightPressed = true;
                }
            } else {
                carouselManager._rightPressed = false;
            }
        }

        if (currentState === GameState.LEVEL && !window.isGamePaused) {
            // Spawn enemies
            if (window.enemiesEnabled && currentTime - lastSpawnTime >= enemySpawnRate) {
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
            const loadout = window.loadoutManager.getLoadout();
            
            ['CERCLE', 'LIGNE', 'TRIANGLE'].forEach(shape => {
                const spell = loadout.bindings[shape];
                if (!spell) return;

                const spellId = spell.id;
                const cooldownMs = spell.cooldown * 1000;
                const lastTime = spellManager.cooldowns[spellId] || -999999;
                const elapsed = currentTime - lastTime;
                
                let angle = 0;
                if (elapsed < cooldownMs) {
                    const progress = elapsed / cooldownMs;
                    angle = progress * 360;
                }
                
                const hudSlot = document.getElementById(`hud-${shape.toLowerCase()}`);
                const needle = hudSlot ? hudSlot.querySelector('.hud-needle') : null;
                if (needle) {
                    needle.style.transform = `rotate(${angle}deg)`;
                }
            });
        }
        
        // Mise à jour du monde procédural infini
        environment.update(player.mesh.position);

        // DEBUG HUD : Coordonnées
        const debugDiv = document.getElementById("debugCoord");
        if (debugDiv) {
            const px = player.mesh.position.x.toFixed(1);
            const pz = player.mesh.position.z.toFixed(1);
            const cx = Math.floor(player.mesh.position.x / 32);
            const cz = Math.floor(player.mesh.position.z / 32);
            debugDiv.innerText = `POS: ${px}, ${pz} | CHUNK: ${cx}, ${cz} | MODE: ${environment.mode}`;
        }

        scene.render();
    });

    console.log("Arcane Glyphs : Architecture Gameplay Intégrée !");
});
