export class CameraManager {
    constructor(scene) {
        this.scene = scene;
        
        // --- LES PARAMÈTRES À TOUCHER ---
        this.distance = 10;  // Le recul (Axe Z) - Réduit pour zoomer
        this.height = 10;    // La hauteur (Axe Y) - Réduit pour zoomer
        this.side = 6;       // Le décalage sur le côté (Axe X) - Réduit pour zoomer
        
        this.offset = new BABYLON.Vector3(this.side, this.height, -this.distance);

        this.camera = new BABYLON.UniversalCamera("MainCamera", this.offset.clone(), this.scene);
                this.isFirstPerson = false;
    }

    setTarget(playerMesh) {
        this.targetMesh = playerMesh;
        this.camera.lockedTarget = this.targetMesh; 
    }

    toggleMode() {
        if (!this.targetMesh) return;

        if (!this.isFirstPerson) {
            // Switch to First Person
            this.isFirstPerson = true;
            this.camera.lockedTarget = null;
            
            // Positionner la caméra au niveau de la tête du joueur
            this.camera.position = this.targetMesh.position.add(new BABYLON.Vector3(0, 1.5, 0));
            
            // Regarder vers l'avant du joueur
            const forward = this.targetMesh.getDirection(new BABYLON.Vector3(0, 0, 1));
            this.camera.setTarget(this.camera.position.add(forward));
            
            // Attacher les contrôles pour pouvoir tourner la tête avec la souris
            const canvas = this.scene.getEngine().getRenderingCanvas();
            this.camera.attachControl(canvas, true);
            
            // Cacher le mesh du joueur pour ne pas bloquer la vue
            this.targetMesh.isVisible = false;
            this.targetMesh.getChildMeshes().forEach(m => m.isVisible = false);
            
            console.log("[CameraManager] Mode Première Personne activé");
        } else {
            // Switch back to Top-Down
            this.isFirstPerson = false;
            
            // Détacher les contrôles de la souris
            this.camera.detachControl();
            
            this.camera.lockedTarget = this.targetMesh;
            this.camera.position = this.targetMesh.position.add(this.offset);
            
            // Réafficher le mesh du joueur
            this.targetMesh.isVisible = true;
            this.targetMesh.getChildMeshes().forEach(m => m.isVisible = true);
            
            console.log("[CameraManager] Mode Caméra Globale activé");
        }
    }

    update() {
        if (!this.targetMesh) return;
        
        if (!this.isFirstPerson) {
            // La caméra maintient sa distance parfaite par rapport à la position du joueur
            this.camera.position = this.targetMesh.position.add(this.offset);
        } else {
            // En FPS, on colle la caméra à la tête du joueur (en ignorant sa rotation pour l'instant)
            this.camera.position = this.targetMesh.position.add(new BABYLON.Vector3(0, 1.5, 0));
        }
    }
}