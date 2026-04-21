import { InfiniteMap } from './InfiniteMap.js';
import { assetLibrary } from './AssetLibrary.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.infiniteMap = null;
        this.hubGround = null;
        this.mode = 'HUB';
        this.setupLights();
        this.createHubGround();
    }

    createHubGround() {
        // Création de l'îlot vert du HUB (50x50m)
        this.hubGround = BABYLON.MeshBuilder.CreateGround("hubGround", { width: 50, height: 50 }, this.scene);
        const mat = new BABYLON.StandardMaterial("hubMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.2); // Vert sombre
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        this.hubGround.material = mat;
        this.hubGround.position.y = -0.01; // Évite les conflits de rendu (z-fighting)
        this.hubGround.isVisible = true;
        this.hubGround.checkCollisions = true; // Empêche le joueur de passer à travers
    }

    async init() {
        console.log("[ENVIRONMENT] Initialisation...");
        await assetLibrary.load(this.scene);
        
        this.infiniteMap = new InfiniteMap(this.scene);
        // Au départ, la carte infinie est inactive/invisible
        this.setMode('HUB');
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'HUB') {
            this.hubGround.isVisible = true;
            if (this.infiniteMap) {
                this.infiniteMap.activeChunks.forEach(chunk => {
                    chunk.rootNode.setEnabled(false);
                });
            }
        } else {
            this.hubGround.isVisible = false;
            if (this.infiniteMap) {
                this.infiniteMap.activeChunks.forEach(chunk => {
                    chunk.rootNode.setEnabled(true);
                });
                // On s'assure d'un spawn safe si on entre dans le niveau
                if (window.player) {
                    this.infiniteMap.ensureSafeSpawn(window.player);
                }
            }
        }
    }

    setupLights() {
        // Une lumière d'ambiance qui éclaire tout
        this.light = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.light.intensity = 0.5;
        this.light.diffuse = new BABYLON.Color3(1, 0.9, 0.8);
        this.light.groundColor = new BABYLON.Color3(0.5, 0.2, 0.1);
    }

    update(playerPosition) {
        // IMPORTANT: On ne génère des chunks QUE si on est en mode LEVEL
        if (this.mode === 'LEVEL' && this.infiniteMap) {
            this.infiniteMap.update(playerPosition);
        }
    }
}