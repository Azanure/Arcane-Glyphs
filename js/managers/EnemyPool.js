import { RoseKnightEnemy, SkeletonWarriorEnemy, StoneGolemEnemy } from '../entities/ElementalEnemies.js';

export class EnemyPool {
    constructor(scene) {
        this.scene = scene;
        this.pool = {
            'rose_knight': [],
            'skeleton_warrior': [],
            'stone_golem': []
        };
        this.activeEnemies = []; // Not strictly needed by the pool, but can be useful
    }

    /**
     * Preloads instances of enemies into the pool.
     */
    async preload(counts) {
        console.log(`[EnemyPool] Preloading enemies...`, counts);
        
        // Hide them far away and disable
        const hiddenPos = new BABYLON.Vector3(0, -100, 0);

        // Instanciate Rose Knights
        for (let i = 0; i < (counts.rose_knight || 0); i++) {
            const enemy = new RoseKnightEnemy(this.scene, hiddenPos, 1);
            enemy.mesh.setEnabled(false);
            enemy.typeKey = 'rose_knight';
            this.pool['rose_knight'].push(enemy);
        }

        // Instanciate Skeleton Warriors
        for (let i = 0; i < (counts.skeleton_warrior || 0); i++) {
            const enemy = new SkeletonWarriorEnemy(this.scene, hiddenPos, 1);
            enemy.mesh.setEnabled(false);
            enemy.typeKey = 'skeleton_warrior';
            this.pool['skeleton_warrior'].push(enemy);
        }

        // Instanciate Stone Golems
        for (let i = 0; i < (counts.stone_golem || 0); i++) {
            const enemy = new StoneGolemEnemy(this.scene, hiddenPos, 1);
            enemy.mesh.setEnabled(false);
            enemy.typeKey = 'stone_golem';
            this.pool['stone_golem'].push(enemy);
        }
        
        console.log(`[EnemyPool] Preload complete.`);
    }

    /**
     * Retrieves an enemy from the pool and respawns it.
     */
    spawn(typeKey, spawnPoint, difficultyLevel) {
        let enemyList = this.pool[typeKey];
        if (!enemyList) return null;

        let enemy = enemyList.pop();

        if (!enemy) {
            // Pool empty! Fallback to creating a new one (should rarely happen if pool is large enough)
            console.warn(`[EnemyPool] Pool exhausted for ${typeKey}. Creating new instance on the fly...`);
            if (typeKey === 'rose_knight') enemy = new RoseKnightEnemy(this.scene, spawnPoint, difficultyLevel);
            else if (typeKey === 'skeleton_warrior') enemy = new SkeletonWarriorEnemy(this.scene, spawnPoint, difficultyLevel);
            else if (typeKey === 'stone_golem') enemy = new StoneGolemEnemy(this.scene, spawnPoint, difficultyLevel);
            
            if (enemy) enemy.typeKey = typeKey;
        } else {
            enemy.respawn(spawnPoint, difficultyLevel);
        }

        if (enemy) {
            this.activeEnemies.push(enemy);
        }
        return enemy;
    }

    /**
     * Returns an enemy to the pool.
     */
    release(enemy) {
        if (!enemy || !enemy.typeKey) return;
        
        // Remove from active list
        const index = this.activeEnemies.indexOf(enemy);
        if (index > -1) {
            this.activeEnemies.splice(index, 1);
        }

        // Push back to pool
        if (this.pool[enemy.typeKey]) {
            this.pool[enemy.typeKey].push(enemy);
        }
    }
}
