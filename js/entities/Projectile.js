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
        
        const targetPos = this.target.mesh.position.clone();
        targetPos.y = 1; // On vise le torse de l'ennemi au lieu de ses pieds
        
        const direction = targetPos.subtract(this.mesh.position);
        
        // On vérifie la distance. On peut aussi ignorer Y pour plus de permissivité
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
