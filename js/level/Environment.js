import { InfiniteMap } from './InfiniteMap.js';
import { assetLibrary } from './AssetLibrary.js';

/**
 * Environment — Gère exclusivement l'environnement de combat (Level).
 * Le Hub possède son propre sol défini dans HubScene.js.
 */
export class Environment {
    constructor(scene) {
        this.scene       = scene;
        this.infiniteMap = null;
        this._setupLights();
    }

    _setupLights() {
        this.light = new BABYLON.HemisphericLight('levelAmbient', new BABYLON.Vector3(0, 1, 0), this.scene);
        this.light.intensity   = 0.5;
        this.light.diffuse     = new BABYLON.Color3(1, 0.9, 0.8);
        this.light.groundColor = new BABYLON.Color3(0.5, 0.2, 0.1);
    }

    async init() {
        console.log('[Environment] Initialisation du Level...');
        await assetLibrary.load(this.scene);
        this.infiniteMap = new InfiniteMap(this.scene);

        // Spawner le joueur sur une case sûre dès le départ
        if (window.player) {
            this.infiniteMap.ensureSafeSpawn(window.player);
        }
        console.log('[Environment] Prête.');
    }

    update(playerPosition) {
        if (this.infiniteMap) {
            this.infiniteMap.update(playerPosition);
        }
    }
}