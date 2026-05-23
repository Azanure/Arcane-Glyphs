export class AssetLibrary {
    constructor() {
        this.meshes = new Map();
        this.isLoaded = false;
    }

    /**
     * Réinitialise la bibliothèque pour permettre le rechargement dans une nouvelle scène.
     * Appelé par LevelScene avant chaque init().
     */
    reset() {
        this.meshes = new Map();
        this.isLoaded = false;
        console.log('[AssetLibrary] Réinitialisée.');
    }

    async load(scene) {
        if (this.isLoaded) return;
        
        console.log("[ASSETS] Chargement de lava_world.glb...");
        
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/worlds/lava_world/", "lava_world.glb", scene);
            
            // Masquer la racine
            result.meshes[0].setEnabled(false);
            
            // Stocker chaque mesh par son nom ("name")
            for(let mesh of result.meshes) {
                // Ignore the _root_ node
                if(mesh.name === "__root__") continue;
                
                // Assurer que le mesh source est invisible mais ACTIF
                // (Si désactivé, les instances ne s'affichent pas !)
                mesh.setEnabled(true);
                mesh.isVisible = false;
                mesh.isPickable = false;
                
                this.meshes.set(mesh.name, mesh);
                // console.log(`[ASSETS] Tile chargée : ${mesh.name}`);
            }
            
            this.isLoaded = true;
            // console.log("[ASSETS] Chargement terminé.");
        } catch (e) {
            console.error("[ASSETS] Erreur lors du chargement de lava_world.glb", e);
        }
    }

    /**
     * Crée une instance d'un mesh donné par son nom.
     */
    createInstance(meshName, instanceName) {
        if (!this.isLoaded) return null;
        
        const sourceMesh = this.meshes.get(meshName);
        if (!sourceMesh) {
            // console.warn(`[ASSETS] Mesh non trouvé : ${meshName}`);
            return null;
        }

        // On ne peut instancier qu'un mesh qui a geometry. 
        // Si c're un TransformNode (groupe), createInstance fail. Mais GLTF meshes sont typiquement valides si pas _root_.
        try {
            const inst = sourceMesh.createInstance(instanceName);
            inst.isPickable = true; // Pour la détection de collision par Raycast
            // Optionnel: inst.freezeWorldMatrix() devra être fait APRES le positionnement dans TerrainChunk
            return inst;
        } catch (e) {
            // Fallback si ce n'est pas instanciable directement (ex: c'est un noeud parent)
            const clone = sourceMesh.clone(instanceName);
            clone.setEnabled(true);
            return clone;
        }
    }
}

export const assetLibrary = new AssetLibrary();
