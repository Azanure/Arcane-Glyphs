export class CameraManager {
    constructor(scene) {
        this.scene = scene;
        
        // --- LES PARAMÈTRES À TOUCHER ---
        this.distance = 15;  // Le recul (Axe Z)
        this.height = 15;    // La hauteur (Axe Y) - on l'augmente un peu pour bien voir
        this.side = 10;      // Le décalage sur le côté (Axe X) <- NOUVEAU PARAMÈTRE
        
        this.offset = new BABYLON.Vector3(this.side, this.height, -this.distance);

        this.camera = new BABYLON.UniversalCamera("MainCamera", this.offset, this.scene);
    }

    setTarget(playerMesh) {
        this.targetMesh = playerMesh;
        this.camera.lockedTarget = this.targetMesh; 
    }

    update() {
        if (!this.targetMesh) return;
        
        // La caméra maintient sa distance parfaite par rapport à la position du joueur
        this.camera.position = this.targetMesh.position.add(this.offset);
    }
}