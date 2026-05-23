/**
 * LevelScene — Scène de combat (infinite map, ennemis, sorts).
 * Complètement indépendante de HubScene.
 */

import { Player }               from '../entities/Player.js';
import { CameraManager }        from '../managers/CameraManager.js';
import { InputManager }         from '../managers/InputManager.js';
import { SpellManager }         from '../managers/SpellManager.js';
import { WaveManager }          from '../managers/WaveManager.js';
import { RoseKnightEnemy, SkeletonWarriorEnemy, StoneGolemEnemy } from '../entities/ElementalEnemies.js';
import { XpOrb }                from '../entities/XpOrb.js';
import { Environment }          from '../level/Environment.js';
import { assetLibrary }         from '../level/AssetLibrary.js';
import { PauseManager } from '../managers/PauseManager.js';
import { SpatialHashGrid }      from '../managers/SpatialHashGrid.js';
import { EnemyPool }            from '../managers/EnemyPool.js';

export class LevelScene {
    constructor(engine, sharedState) {
        this.engine      = engine;
        this.sharedState = sharedState;
        this.scene       = new BABYLON.Scene(engine);
        this._disposed   = false;

        // Callback vers SceneManager
        this.onReturnToHub = null;

        // Systèmes
        this.player        = null;
        this.cameraManager = null;
        this.inputManager  = null;
        this.spellManager  = null;
        this.waveManager   = null;
        this.environment   = null;

        // Entités
        this.enemies  = [];
        this.xpOrbs   = [];

        // Spatial Hash Grid pour séparation ennemis en O(n)
        this.spatialGrid = new SpatialHashGrid(3);

        // Temps
        this.gameTime      = 0;
        this._lastRealTime = performance.now();
        this._lastSpawnTime = 0;
        this._enemySpawnRate = 2000;

        // État
        this._paused = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALISATION
    // ─────────────────────────────────────────────────────────────────────────
    async init() {
        // Réinitialiser la bibliothèque d'assets pour cette nouvelle scène
        assetLibrary.reset();

        window.currentScene = this.scene;
        if (!window.inspectorAdded) {
            window.inspectorAdded = true;
            window.addEventListener('keydown', (e) => {
                if ((e.key === 'F4' || e.key === 'i' || e.key === 'I') && window.currentScene) {
                    e.preventDefault();
                    if (window.currentScene.debugLayer.isVisible()) window.currentScene.debugLayer.hide();
                    else window.currentScene.debugLayer.show();
                }
            });
        }

        // Systèmes de base (InputManager, SpellManager, WaveManager)
        this.inputManager = new InputManager();
        this.spellManager = new SpellManager(this.scene);
        this.waveManager  = new WaveManager(this.scene);

        // Charger le modèle du personnage sélectionné
        await this._loadPlayerCharacter();

        // Charger le modèle des ennemis
        await this._loadEnemies();

        // --- Global Resistances Init ---
        window.globalResistances = {};
        if (window.ElementDatabase) {
            Object.keys(window.ElementDatabase).forEach(el => {
                window.globalResistances[el] = 0;
            });
        }
        window.updateResistanceUI = () => { this._updateAIDirectorUI(); };

        // Créer le joueur AVANT l'environnement (ensureSafeSpawn a besoin de window.player)
        this.player = new Player(this.scene, this.sharedState);
        this.cameraManager = new CameraManager(this.scene);
        this.cameraManager.setTarget(this.player.mesh);

        // Globals requis avant l'init de l'environnement
        window.player         = this.player;
        window.isGamePaused   = false;
        window.gameTime       = 0;
        window.enemiesEnabled = true; 
        window.spellCooldowns = this.spellManager.cooldowns;
        window.activeSpellIds = [];

        // Environnement (charge lava_world.glb + ensureSafeSpawn)
        this.environment = new Environment(this.scene);
        await this.environment.init();

        // Pré-générer les chunks autour du point de spawn AVANT le démarrage de la boucle.
        this.environment.update(this.player.mesh.position);

        // Reste des globals et DOM
        this._setupGlobals();
        this._setupDOMForLevel();
        
        // Initialiser la pause
        this.pauseManager = new PauseManager(() => {
            if (this.onReturnToHub) this.onReturnToHub();
        }, false);
        
        this._updateAIDirectorUI(); // Initial render

        console.log('[LevelScene] Initialisée.');
    }

    async _loadCharacter(name) {
        const baseUrl = `assets/characters/player/${name}/`;
        let charData = {};
        
        try {
            const res = await BABYLON.SceneLoader.ImportMeshAsync('', baseUrl, `${name}.glb`, this.scene);
            res.meshes[0].setEnabled(false);
            charData.mesh = res.meshes[0];
            charData.animationGroups = res.animationGroups;
            
            try {
                charData.idleContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("", baseUrl + "idle.glb", this.scene);
            } catch(e) {}
            
            try {
                charData.runContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("", baseUrl + "running.glb", this.scene);
            } catch(e) {}
            
            return charData;
        } catch (err) {
            console.error(`[LevelScene] Erreur chargement personnage ${name}:`, err);
            return null;
        }
    }

    async _loadPlayerCharacter() {
        const name = this.sharedState.selectedCharacterName || 'brand';
        window.characterTemplates = {};
        
        const mainChar = await this._loadCharacter(name);
        if (mainChar) window.characterTemplates[name] = mainChar;
        
        if (name !== 'brand') {
            const fallbackChar = await this._loadCharacter('brand');
            if (fallbackChar) window.characterTemplates['brand'] = fallbackChar;
        }
    }

    async _loadEnemies() {
        window.enemyTemplates = window.enemyTemplates || {};

        const toLoad = [
            { key: 'rose_knight',      file: 'rose+quartz+knight+3d+model+++8+animations.glb' },
            { key: 'skeleton_warrior', file: 'skeleton_warrior.glb' },
            { key: 'stone_golem',      file: 'stone_golem.glb' },
        ];

        await Promise.all(toLoad.map(async ({ key, file }) => {
            try {
                const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
                    'assets/characters/ennemies/lava_world/',
                    file,
                    this.scene
                );
                window.enemyTemplates[key] = container;
                console.log(`[LevelScene] Enemy "${key}" loaded (${container.animationGroups.length} anims).`);
            } catch (err) {
                console.error(`[LevelScene] Erreur chargement ennemi "${key}":`, err);
            }
        }));

        // Initialize and preload the EnemyPool
        window.enemyPool = new EnemyPool(this.scene);
        await window.enemyPool.preload({
            'rose_knight': 30,
            'skeleton_warrior': 20,
            'stone_golem': 10
        });
    }

    _setupGlobals() {
        window.isGamePaused    = false;
        window.isPausedByHandLoss = false;
        window.gameTime        = 0;
        window.enemiesEnabled  = true; 
        window.player          = this.player;
        window.spellCooldowns  = this.spellManager.cooldowns;
        window.activeSpellIds  = [];

        // Mise à jour HUD sorts
        window.updateActiveBindingsHub = () => {
            const loadout = window.loadoutManager.getLoadout();
            window.activeSpellIds = [];
            Object.keys(loadout.bindings).forEach(shapeKey => {
                const spell   = loadout.bindings[shapeKey];
                const hudSlot = document.getElementById(`hud-${shapeKey.toLowerCase()}`);
                if (!hudSlot) return;
                const iconEl = hudSlot.querySelector('.hud-spell-icon');
                if (!iconEl) return;
                
                if (spell) {
                    window.activeSpellIds.push(spell.id);
                    if (spell.icon.endsWith('.png')) {
                        iconEl.innerHTML = `<img src="${spell.icon}" style="width:70%; height:70%; object-fit:contain;">`;
                    } else {
                        iconEl.innerHTML = `<span style="font-size:32px">${spell.icon}</span>`;
                    }
                    hudSlot.style.color = window.ElementDatabase?.[spell.element]?.color || '#fff';
                } else {
                    iconEl.innerHTML = '';
                    hudSlot.style.color = '';
                }
            });
        };
        window.updateActiveBindingsHub();

        // Cast de sort via tracking
        window.onShapeDetected = (detectedShape) => {
            if (window.isGamePaused) return;
            const loadout = window.loadoutManager.getLoadout();
            const spell   = loadout.bindings[detectedShape];
            if (!spell) return;
            const lastTime    = this.spellManager.cooldowns[spell.id] || 0;
            const cooldownMs  = spell.cooldown * 1000;
            if (this.gameTime - lastTime >= cooldownMs) {
                // Calculer la direction vers la souris
                let targetDirection = null;
                if (this.scene.activeCamera) {
                    let ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, BABYLON.Matrix.Identity(), this.scene.activeCamera);
                    if (ray.direction.y !== 0) {
                        let t = -ray.origin.y / ray.direction.y;
                        let hitPoint = ray.origin.add(ray.direction.scale(t));
                        targetDirection = hitPoint.subtract(this.player.mesh.position);
                        targetDirection.y = 0;
                        targetDirection.normalize();
                    }
                }

                this.spellManager.castSpell(spell, this.player, this.enemies, targetDirection);
                this.spellManager.cooldowns[spell.id] = this.gameTime;
            }
        };

        // Retour au Hub (appelé par Player.die())
        window.returnToHub = () => {
            if (this.onReturnToHub) this.onReturnToHub();
        };
    }

    _setupDOMForLevel() {
        document.getElementById('uiContainer').classList.remove('hidden'); // HP / XP visibles
        document.getElementById('hudSpells').classList.remove('hidden');
        document.getElementById('hudScoreTimer')?.classList.remove('hidden');
        document.getElementById('fpsDebug')?.classList.remove('hidden');
        document.getElementById('characterSelectionScreen').classList.add('hidden');
        document.getElementById('loadoutScreen').classList.add('hidden');
        document.getElementById('levelUpScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');

        // Wire up Game Over Return Button
        const btnReturn = document.getElementById('btnGameOverReturn');
        if (btnReturn) {
            btnReturn.onclick = () => {
                window.returnToHub();
            };
        }

        this._createDebugRotationPanel();
    }

    _createDebugRotationPanel() {
        const existing = document.getElementById('debugRotationPanel');
        if (existing) {
            existing.style.display = "none";
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BOUCLE DE MISE À JOUR (appelée par SceneManager chaque frame)
    // ─────────────────────────────────────────────────────────────────────────
    update() {
        if (this._disposed) return;

        const now = performance.now();
        const dt  = now - this._lastRealTime;
        this._lastRealTime = now;

        if (!window.isGamePaused) {
            this.gameTime += dt;
            window.gameTime = this.gameTime;
        }

        // — Interaction Level Up (curseur main) —
        if (window.isGamePaused) {
            if (typeof window.smoothedCursorX !== 'undefined') {
                this.player.handleLevelUpInteraction(window.smoothedCursorX, window.smoothedCursorY);
            }
            return; // Laisser SceneManager rendre la scène normalement
        }

        // — Spawn ennemis —
        this.waveManager.update(this.gameTime, this.player, this.enemies);

        // — Mise à jour ennemis —
        // Reconstruction de la grille spatiale O(n) avant les updates
        this.spatialGrid.rebuild(this.enemies);

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(this.player, this.spatialGrid);
            if (enemy.isDead) {
                if (enemy.deathPosition) {
                    this.xpOrbs.push(new XpOrb(this.scene, enemy.deathPosition, enemy.experienceValue));
                }
                this.player.addScore(enemy.experienceValue * 10); // Score in addition to XP
                this.enemies.splice(i, 1);
            }
        }

        // — Mise à jour XP orbs —
        for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
            this.xpOrbs[i].update(this.player);
            if (this.xpOrbs[i].isDestroyed) this.xpOrbs.splice(i, 1);
        }

        // — Joueur, sorts, caméra —
        this.player.update(this.inputManager, this.enemies);
        this.spellManager.update(this.inputManager, this.player, this.enemies);
        this.cameraManager.update();

        // — IA Director UI —
        // (Removed from update loop, updated reactively via window.updateResistanceUI)

        // — HUD Cooldowns —
        this._updateCooldownHUD();

        // — HUD Score & Timer & FPS —
        const timerText = document.getElementById('timerText');
        const scoreText = document.getElementById('scoreText');
        if (timerText && scoreText) {
            const secs = Math.floor(this.gameTime / 1000);
            const m = Math.floor(secs / 60).toString().padStart(2, '0');
            const s = (secs % 60).toString().padStart(2, '0');
            timerText.innerText = `${m}:${s}`;
            scoreText.innerText = `Score: ${this.player.score || 0}`;
        }
        
        const fpsDebug = document.getElementById('fpsDebug');
        if (fpsDebug && this.engine) {
            fpsDebug.innerText = `FPS: ${this.engine.getFps().toFixed(0)}`;
        }

        // — Carte infinie —
        this.environment.update(this.player.mesh.position);

        // — Debug coordonnées —
        this._updateDebugHUD();
    }

    _updateAIDirectorUI() {
        const listEl = document.getElementById("resistanceList");
        if (!listEl || !window.globalResistances) return;
        
        let html = "";
        for (const [elemId, resVal] of Object.entries(window.globalResistances)) {
            if (resVal > 0) {
                const config = window.ElementDatabase ? window.ElementDatabase[elemId] : null;
                const pct = Math.round(resVal * 100);
                html += `<div style="color: ${config ? config.color : '#fff'};">${config ? config.name : elemId}: ${pct}%</div>`;
            }
        }
        if (html === "") {
            html = "<div>No resistances yet</div>";
        }
        listEl.innerHTML = html;
    }

    _updateCooldownHUD() {
        if (!window.loadoutManager) return;
        const loadout = window.loadoutManager.getLoadout();
        Object.keys(loadout.bindings).forEach(shapeKey => {
            const spell = loadout.bindings[shapeKey];
            if (!spell) return;
            const cooldownMs = spell.cooldown * 1000;
            const lastTime   = this.spellManager.cooldowns[spell.id] || -999999;
            const elapsed    = this.gameTime - lastTime;
            const angle      = elapsed < cooldownMs ? (elapsed / cooldownMs) * 360 : 360;
            const hudSlot    = document.getElementById(`hud-${shapeKey.toLowerCase()}`);
            const needle     = hudSlot ? hudSlot.querySelector('.hud-needle') : null;
            if (needle) needle.style.transform = `rotate(${angle}deg)`;
        });
    }

    _updateDebugHUD() {
        const debugDiv = document.getElementById('debugCoord');
        if (debugDiv) debugDiv.style.display = "none";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DISPOSE
    // ─────────────────────────────────────────────────────────────────────────
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        // Sauvegarder les stats joueur dans le sharedState avant de détruire
        if (this.player) this.player.exportState(this.sharedState);

        // Nettoyer les entités
        this.enemies.forEach(e => { if (e.mesh) e.mesh.dispose(); });
        this.xpOrbs.forEach(o => { if (o.mesh) o.mesh.dispose(); });

        // Réinitialiser les globals de combat
        window.returnToHub     = null;
        window.onShapeDetected = null;
        window.enemiesEnabled  = false;

        if (this.pauseManager) {
            this.pauseManager.dispose();
            this.pauseManager = null;
        }

        this.scene.dispose();
        console.log('[LevelScene] Disposée.');
    }
}
