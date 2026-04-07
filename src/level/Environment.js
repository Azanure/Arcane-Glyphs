export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.setupLights();
        this.setupGround();
    }

    setupLights() {
        // Une lumière d'ambiance qui éclaire tout vers le haut
        this.light = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.light.intensity = 0.7;
    }

    setupGround() {
        // Un grand sol plat
        this.ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 50, height: 50}, this.scene);
        
        // On lui donne une couleur vert sombre pour bien voir notre joueur
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.2); 
        this.ground.material = groundMat;
    }
}