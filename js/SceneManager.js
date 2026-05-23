import { SharedGameState } from './SharedGameState.js';
import { HubScene } from './scenes/HubScene.js';
import { LevelScene } from './scenes/LevelScene.js';

/**
 * SceneManager — Orchestre les transitions entre HubScene et LevelScene.
 * Gère le loading screen HTML pendant les changements de scène.
 */
export class SceneManager {
    constructor(engine) {
        this.engine       = engine;
        this.sharedState  = new SharedGameState();
        this.currentScene = null;
        this._transitioning = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transition → HUB
    // ─────────────────────────────────────────────────────────────────────────
    async goToHub() {
        if (this._transitioning) return;
        this._transitioning = true;

        this._showLoadingScreen('Retour au Hub...');
        this.engine.stopRenderLoop();

        if (this.currentScene) {
            this.currentScene.dispose();
            this.currentScene = null;
        }

        // Réinitialiser les stats du joueur (HP, upgrades, niveau) pour la prochaine partie
        this.sharedState.reset();
        
        window.isInHub = true; // Tell tracking and UI that we are in the hub

        const hub = new HubScene(this.engine, this.sharedState);
        hub.onEnterPortal = () => this.goToLevel();

        await hub.init();
        this.currentScene = hub;

        this.engine.runRenderLoop(() => {
            if (!hub._disposed) {
                hub.update();
                hub.scene.render();
            }
        });

        this._hideLoadingScreen();
        this._transitioning = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Transition → LEVEL
    // ─────────────────────────────────────────────────────────────────────────
    async goToLevel() {
        if (this._transitioning) return;
        this._transitioning = true;

        this._showLoadingScreen('Chargement du niveau...');
        this.engine.stopRenderLoop();

        if (this.currentScene) {
            this.currentScene.dispose();
            this.currentScene = null;
        }

        window.isInHub = false; // We are in the level now

        const level = new LevelScene(this.engine, this.sharedState);
        level.onReturnToHub = () => this.goToHub();

        await level.init();
        this.currentScene = level;

        this.engine.runRenderLoop(() => {
            if (!level._disposed) {
                level.update();
                level.scene.render();
            }
        });

        this._hideLoadingScreen();
        this._transitioning = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Loading Screen
    // ─────────────────────────────────────────────────────────────────────────
    _showLoadingScreen(message = 'Chargement...') {
        const el    = document.getElementById('loadingScreen');
        const label = document.getElementById('loadingLabel');
        if (label) label.textContent = message;
        if (el)    el.classList.remove('hidden');
    }

    _hideLoadingScreen() {
        const el = document.getElementById('loadingScreen');
        if (el)  el.classList.add('hidden');
    }
}
