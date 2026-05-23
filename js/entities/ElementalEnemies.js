import { Enemy } from './Enemy.js';

/**
 * Charge un ennemi depuis un template AssetContainer stocké dans window.enemyTemplates.
 * Retourne le rootNode prêt à utiliser, ou null si le template est absent.
 * @param {string} templateKey - Clé dans window.enemyTemplates
 * @param {BABYLON.Scene} scene
 * @param {BABYLON.Vector3} scale
 */
function _instantiateFromTemplate(templateKey, scene, scale) {
    if (!window.enemyTemplates || !window.enemyTemplates[templateKey]) return null;

    const container = window.enemyTemplates[templateKey];

    // CRITIQUE : Reset skeleton à la pose de repos pour éviter les poses aléatoires au spawn
    container.animationGroups.forEach(ag => ag.stop());
    container.skeletons.forEach(sk => sk.returnToRest());

    const cloneId = Math.random().toString(36).substr(2, 5);
    // OPTIMISATION: cloneMaterials = false pour éviter les freeze liés aux compilations de shaders
    const entries = container.instantiateModelsToScene(name => name + '_' + cloneId, false);

    const rootNode = new BABYLON.TransformNode(`${templateKey}_root_${cloneId}`, scene);

    entries.rootNodes.forEach(rn => { rn.parent = rootNode; });

    // Désactiver toutes les animations (seront réactivées individuellement plus tard)
    entries.animationGroups.forEach(ag => { ag.stop(); });
    rootNode.animationGroups = entries.animationGroups;

    // Désactiver le raycasting sur les sous-meshes du personnage
    rootNode.getChildMeshes(false).forEach(m => { m.isPickable = false; });

    rootNode.scaling = scale;
    rootNode.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, 0);

    return rootNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rose Quartz Knight — ennemi de base rapide
// ─────────────────────────────────────────────────────────────────────────────
export class RoseKnightEnemy extends Enemy {
    constructor(scene, playerPos, playerLevel = 1) {
        try {
            const rootNode = _instantiateFromTemplate(
                'rose_knight', scene, new BABYLON.Vector3(1.2, 1.2, 1.2)
            );
            super(scene, playerPos, 0, new BABYLON.Color3(0.8, 0.4, 0.6), rootNode, playerLevel);
            if (rootNode.animationGroups && rootNode.animationGroups.length > 7) {
                // Rose Knight — 8 animations NlaTrack (indices identifiés par durée)
                this.runAnims    = [rootNode.animationGroups[7]]; // 1.29s → Run
                this.attackAnims = [rootNode.animationGroups[2]]; // 6.63s → Chop/Slash
                this.deathAnims  = [rootNode.animationGroups[0],  // 3.04s → Fall
                                    rootNode.animationGroups[3]]; // 5.54s → Defeat_02
            } else {
                this.runAnims = []; this.attackAnims = []; this.deathAnims = [];
            }
        } catch (err) {
            _showDebugError(err, 'RoseKnightEnemy');
            throw err;
        }
    }

    respawn(playerPos, playerLevel) {
        this.baseHp = 200;
        this.baseDamage = 5;
        this.baseSpeed = 0.035;
        this.baseExp = 5;
        super.respawn(playerPos, playerLevel);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Warrior — ennemi plus résistant, légèrement plus lent
// ─────────────────────────────────────────────────────────────────────────────
export class SkeletonWarriorEnemy extends Enemy {
    constructor(scene, playerPos, playerLevel = 1) {
        try {
            const rootNode = _instantiateFromTemplate(
                'skeleton_warrior', scene, new BABYLON.Vector3(1.0, 1.0, 1.0)
            );
            super(scene, playerPos, 0, new BABYLON.Color3(0.9, 0.9, 0.7), rootNode, playerLevel);
            if (rootNode.animationGroups) {
                this.runAnims = rootNode.animationGroups.filter(ag => ag && ag.name && (ag.name.toLowerCase().includes('run') || ag.name.toLowerCase().includes('walk') || ag.name.toLowerCase().includes('move')));
                this.attackAnims = rootNode.animationGroups.filter(ag => ag && ag.name && ag.name.toLowerCase().includes('attack'));
                this.deathAnims = rootNode.animationGroups.filter(ag => ag && ag.name && (ag.name.toLowerCase().includes('death') || ag.name.toLowerCase().includes('die')));
            } else {  
                this.runAnims = []; this.attackAnims = []; this.deathAnims = [];
            }
            if (rootNode.animationGroups && rootNode.animationGroups.length >= 5) {
                // Skeleton Warrior — 7 animations NlaTrack (indices identifiés par durée)
                this.runAnims    = [rootNode.animationGroups[0]]; // 1.29s → Run
                this.attackAnims = [rootNode.animationGroups[4]]; // 6.63s → Chop/Slash
                this.deathAnims  = [rootNode.animationGroups[2]]; // 5.54s → Defeat_02 (pas de fall)
            }
        } catch (err) {
            _showDebugError(err, 'SkeletonWarriorEnemy');
            throw err;
        }
    }

    respawn(playerPos, playerLevel) {
        this.baseHp = 500;
        this.baseDamage = 3;
        this.baseSpeed = 0.050;
        this.baseExp = 10;
        super.respawn(playerPos, playerLevel);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stone Golem — tank lent mais très résistant
// ─────────────────────────────────────────────────────────────────────────────
export class StoneGolemEnemy extends Enemy {
    constructor(scene, playerPos, playerLevel = 1) {
        try {
            const rootNode = _instantiateFromTemplate(
                'stone_golem', scene, new BABYLON.Vector3(1.5, 1.5, 1.5)
            );
            super(scene, playerPos, 0, new BABYLON.Color3(0.5, 0.5, 0.5), rootNode, playerLevel);
            if (rootNode.animationGroups) {
                this.runAnims = rootNode.animationGroups.filter(ag => ag && ag.name && (ag.name.toLowerCase().includes('run') || ag.name.toLowerCase().includes('walk') || ag.name.toLowerCase().includes('move')));
                this.attackAnims = rootNode.animationGroups.filter(ag => ag && ag.name && ag.name.toLowerCase().includes('attack'));
                this.deathAnims = rootNode.animationGroups.filter(ag => ag && ag.name && (ag.name.toLowerCase().includes('death') || ag.name.toLowerCase().includes('die')));
            } else {
                this.runAnims = []; this.attackAnims = []; this.deathAnims = [];
            }
            if (rootNode.animationGroups && rootNode.animationGroups.length >= 4) {
                // Stone Golem — 7 animations NlaTrack (indices identifiés par durée)
                this.runAnims    = [rootNode.animationGroups[6]]; // 1.29s → Run
                this.attackAnims = [rootNode.animationGroups[3]]; // 6.63s → Chop/Slash
                this.deathAnims  = [rootNode.animationGroups[1]]; // 3.04s → Fall
            }
        } catch (err) {
            _showDebugError(err, 'StoneGolemEnemy');
            throw err;
        }
    }

    respawn(playerPos, playerLevel) {
        this.baseHp = 2000;
        this.baseDamage = 3;
        this.baseSpeed = 0.025;
        this.baseExp = 20;
        super.respawn(playerPos, playerLevel);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Alias pour compatibilité avec les anciens imports (WaveManager etc.)
// ─────────────────────────────────────────────────────────────────────────────
export { RoseKnightEnemy as GenericEnemy };

// ─────────────────────────────────────────────────────────────────────────────
// Shared methods — startAttack et die (partagés entre tous les types)
// ─────────────────────────────────────────────────────────────────────────────

function _addSharedMethods(proto) {
    proto.startAttack = function(player) {
        if (this.isAttacking || this.isDead) return;
        this.isAttacking = true;
        this.runAnims.forEach(a => a.stop());

        if (this.attackAnims.length > 0) {
            const atkAnim = this.attackAnims[0];
            atkAnim.start(false);
            atkAnim.onAnimationEndObservable.addOnce(() => {
                if (this.isDead) return;
                const dist = BABYLON.Vector3.Distance(this.mesh.position, player.mesh.position);
                if (dist < this.attackRange + 0.5) player.takeDamage(this.damage);
                if (!this.isDead) {
                    this.runAnims.forEach(a => a.start(true));
                    setTimeout(() => { this.isAttacking = false; }, 500);
                }
            });
        } else {
            player.takeDamage(this.damage);
            this.isAttacking = false;
        }
    };

    proto.die = function() {
        if (this.isDead) return;
        this.isDead = true;
        this.deathPosition = this.mesh.position.clone();

        // Stop run & attack anims
        try { if (this.runAnims) this.runAnims.forEach(a => a.stop()); } catch(e) {}
        try { if (this.attackAnims) this.attackAnims.forEach(a => a.stop()); } catch(e) {}

        const releaseToPool = () => {
            if (this.mesh) this.mesh.setEnabled(false);
            if (window.enemyPool) window.enemyPool.release(this);
        };

        // Joue une animation de mort (fall ou defeat_02) et cache le mesh à la fin
        if (this.deathAnims && this.deathAnims.length > 0) {
            const deathAnim = this.deathAnims[0];
            try {
                deathAnim.start(false); // play once
                deathAnim.onAnimationEndObservable.addOnce(() => releaseToPool());
                // Sécurité : si l'observable ne se déclenche pas après 8s, on force
                setTimeout(releaseToPool, 8000);
            } catch(e) {
                releaseToPool();
            }
        } else {
            releaseToPool();
        }
    };
}

_addSharedMethods(RoseKnightEnemy.prototype);
_addSharedMethods(SkeletonWarriorEnemy.prototype);
_addSharedMethods(StoneGolemEnemy.prototype);

// ─────────────────────────────────────────────────────────────────────────────
// Affiche une erreur de debug dans le DOM
// ─────────────────────────────────────────────────────────────────────────────
function _showDebugError(err, className) {
    let errDiv = document.getElementById('debugErr');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'debugErr';
        errDiv.style.cssText = 'position:absolute;top:10px;left:10px;color:red;background:black;padding:10px;z-index:99999;white-space:pre;';
        document.body.appendChild(errDiv);
    }
    errDiv.innerText = `Error in ${className}:\n${err.message}\n${err.stack}`;
}
