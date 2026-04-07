import { Enemy } from './Enemy.js';

export class FireEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        // Parent commun
        const rootNode = new BABYLON.TransformNode("fireEnemyRoot", scene);
        
        let runMesh = null;
        let attackMesh = null;
        let runAnimations = [];
        let attackAnimations = [];
        
        // 1. Setup Modèle COURSE
        if (window.enemyTemplates && window.enemyTemplates['fire_run']) {
            const template = window.enemyTemplates['fire_run'];
            runMesh = template.mesh.clone("fireRunClone", rootNode, false);
            runMesh.setEnabled(true);
            
            template.animationGroups.forEach(ag => {
                const newAG = ag.clone(ag.name + "_clone", (oldTarget) => {
                    return runMesh.getChildTransformNodes().find(n => n.name === oldTarget.name) || 
                           runMesh.getChildMeshes().find(m => m.name === oldTarget.name) || 
                           oldTarget;
                });
                newAG.loopAnimation = true;
                // Verrouillage In-Place
                newAG.targetedAnimations.forEach(ta => {
                    if (ta.animation.targetProperty === "position") {
                        ta.animation.getKeys().forEach(k => { k.value.x = 0; k.value.z = 0; });
                    }
                });
                runAnimations.push(newAG);
            });
            runMesh.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
            // On utilise rotationQuaternion car les GLB l'activent par défaut, annulant 'rotation.y'
            runMesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, 0);
        }

        // 2. Setup Modèle ATTAQUE
        if (window.enemyTemplates && window.enemyTemplates['fire_attack']) {
            const template = window.enemyTemplates['fire_attack'];
            attackMesh = template.mesh.clone("fireAttackClone", rootNode, false);
            attackMesh.setEnabled(false);
            
            template.animationGroups.forEach(ag => {
                const newAG = ag.clone(ag.name + "_clone", (oldTarget) => {
                    return attackMesh.getChildTransformNodes().find(n => n.name === oldTarget.name) || 
                           attackMesh.getChildMeshes().find(m => m.name === oldTarget.name) || 
                           oldTarget;
                });
                newAG.loopAnimation = false;
                // Verrouillage In-Place
                newAG.targetedAnimations.forEach(ta => {
                    if (ta.animation.targetProperty === "position") {
                        ta.animation.getKeys().forEach(k => { k.value.x = 0; k.value.z = 0; });
                    }
                });
                attackAnimations.push(newAG);
            });
            attackMesh.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
            attackMesh.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, 0);
        }

        super(scene, playerPos, radius, new BABYLON.Color3(1, 0, 0), rootNode);
        this.elementType = 'fire';
        this.runMesh = runMesh;
        this.attackMesh = attackMesh;
        this.runAnims = runAnimations;
        this.attackAnims = attackAnimations;

        if (this.runAnims.length > 0) {
            const runAnim = this.runAnims.find(a => a.name.toLowerCase().includes("run")) || this.runAnims[0];
            if (runAnim) runAnim.start(true);
        }
    }

    startAttack(player) {
        if (this.isAttacking || this.isDead) return;
        this.isAttacking = true;

        if (this.runMesh) this.runMesh.setEnabled(false);
        if (this.attackMesh) this.attackMesh.setEnabled(true);
        this.runAnims.forEach(a => a.stop());

        if (this.attackAnims.length > 0) {
            const atkAnim = this.attackAnims.find(a => a.name.toLowerCase().includes("attack")) || this.attackAnims[0];
            if (atkAnim) {
                atkAnim.start(false); 
                atkAnim.onAnimationEndObservable.addOnce(() => {
                    if (this.isDead) return;
                    const dist = BABYLON.Vector3.Distance(this.mesh.position, player.mesh.position);
                    if (dist < this.attackRange + 0.5) {
                        player.takeDamage(this.damage);
                    }
                    if (!this.isDead) {
                        if (this.attackMesh) this.attackMesh.setEnabled(false);
                        if (this.runMesh) this.runMesh.setEnabled(true);
                        this.runAnims.forEach(a => a.start(true));
                        setTimeout(() => { this.isAttacking = false; }, 500);
                    }
                });
            }
        } else {
            player.takeDamage(this.damage);
            this.isAttacking = false;
        }
    }
}

export class IceEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        super(scene, playerPos, radius, new BABYLON.Color3(0, 0.4, 1));
        this.elementType = 'ice';
    }
}

export class EarthEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        super(scene, playerPos, radius, new BABYLON.Color3(0.6, 0.3, 0));
        this.elementType = 'earth';
    }
}
