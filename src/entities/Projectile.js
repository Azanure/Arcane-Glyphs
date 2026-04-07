export class Projectile {
    constructor(scene, startPos, targetEnemy, damage) {
        this.scene = scene;
        this.speed = 0.5;
        this.damage = damage || 25;
        this.target = targetEnemy;
        
        this.mesh = BABYLON.MeshBuilder.CreateSphere("projectile", {diameter: 0.4}, scene);
        const mat = new BABYLON.StandardMaterial("projMat", scene);
        mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        this.mesh.material = mat;
        
        this.mesh.position = startPos.clone();
        this.mesh.position.y = 1; 
        this.isDestroyed = false;
    }
    
    update() {
        if (this.isDestroyed) return;
        
        if (!this.target || this.target.isDead) {
            this.destroy();
            return;
        }
        
        const direction = this.target.mesh.position.subtract(this.mesh.position);
        
        if (direction.length() < this.speed) {
            this.target.takeDamage(this.damage);
            this.destroy();
        } else {
            direction.normalize();
            this.mesh.position.addInPlace(direction.scale(this.speed));
            this.mesh.position.y = 1; 
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        this.mesh.dispose();
    }
}
