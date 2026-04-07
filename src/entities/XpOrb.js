export class XpOrb {
    constructor(scene, position, xpValue) {
        this.scene = scene;
        this.xpValue = xpValue;
        this.speed = 0.2;
        this.isDestroyed = false;

        this.mesh = BABYLON.MeshBuilder.CreateSphere("xporb", { diameter: 0.5 }, scene);
        this.mesh.position.copyFrom(position);
        this.mesh.position.y = 0.5;

        const mat = new BABYLON.StandardMaterial("orbMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green
        mat.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        this.mesh.material = mat;
    }

    update(player) {
        if (this.isDestroyed || player.isDead) return;

        const distance = BABYLON.Vector3.Distance(this.mesh.position, player.mesh.position);

        // Check for intersection
        if (distance < 1.0 || this.mesh.intersectsMesh(player.mesh, false)) {
            player.gainXp(this.xpValue);
            this.destroy();
            return;
        }

        // Check attraction
        if (distance <= player.attractionRadius) {
            const direction = player.mesh.position.subtract(this.mesh.position);
            direction.normalize();
            this.mesh.position.addInPlace(direction.scale(this.speed));
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.mesh.dispose();
    }
}
