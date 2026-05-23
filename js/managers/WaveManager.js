import { RoseKnightEnemy, SkeletonWarriorEnemy, StoneGolemEnemy } from '../entities/ElementalEnemies.js';

// Pool d'ennemis disponibles selon la difficulté
function _pickEnemyTypeKey(difficultyLevel) {
    const roll = Math.random();
    if (difficultyLevel >= 3 && roll < 0.15) return 'stone_golem';      // 15% golem dès niveau 3 (2 minutes)
    if (difficultyLevel >= 2 && roll < 0.40) return 'skeleton_warrior'; // 25% skeleton dès niveau 2 (1 minute)
    return 'rose_knight';
}

export class WaveManager {
    constructor(scene) {
        this.scene = scene;
        this.lastSpawnTime = 0;
    }

    _isSpawnPositionSafe(scene, x, z) {
        if (!window.terrainNoiseGen || !window.terrainPitGen) return true; // Failsafe if not generated yet

        const TILE_SIZE = 2;
        const tileX = Math.floor(x / TILE_SIZE);
        const tileZ = Math.floor(z / TILE_SIZE);

        if (window.terrainNoiseGen.isLava(tileX, tileZ)) return false;
        if (window.terrainPitGen.isPit(tileX, tileZ)) return false;

        return true;
    }

    /**
     * Cherche une position de spawn sûre autour du joueur.
     * Tente jusqu'à maxTries angles différents.
     */
    _findSafeSpawnPosition(scene, playerPos, minDist, maxTries = 12) {
        for (let i = 0; i < maxTries; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * 10;
            const x = playerPos.x + Math.cos(angle) * dist;
            const z = playerPos.z + Math.sin(angle) * dist;
            if (this._isSpawnPositionSafe(scene, x, z)) {
                return { x, z };
            }
        }
        return null;
    }

    update(gameTime, player, enemies) {
        if (!window.enemiesEnabled) return;

        // Difficulty increases by 1 every 20 seconds of survival time for testing
        let difficultyLevel = Math.floor(gameTime / 20000) + 1;

        // More aggressive spawn logic
        let maxEnemies = 30 + (difficultyLevel * 10);

        // Spawn plus lent (divisé par 2 par rapport à l'original)
        let spawnRate = Math.max(200, 2000 - (difficultyLevel * 100));

        if (gameTime - this.lastSpawnTime >= spawnRate) {
            this.lastSpawnTime = gameTime;
            let batchSize = 3 + Math.floor(difficultyLevel / 2);
            this.spawnQueue = (this.spawnQueue || 0) + batchSize;
        }

        // OPTIMISATION : Spawner un seul ennemi par frame pour éviter les lag spikes
        if (this.spawnQueue > 0 && enemies.length < maxEnemies) {
            this.spawnQueue--;

            const spawnPos = this._findSafeSpawnPosition(this.scene, player.mesh.position, 20);
            if (!spawnPos) {
                // If we couldn't find a safe spot, we put it back in the queue
                this.spawnQueue++;
                return;
            }

            try {
                const typeKey = _pickEnemyTypeKey(difficultyLevel);
                const spawnPoint = new BABYLON.Vector3(spawnPos.x, player.mesh.position.y, spawnPos.z);
                const newEnemy = window.enemyPool.spawn(typeKey, spawnPoint, difficultyLevel);
                if (newEnemy) {
                    enemies.push(newEnemy);
                }
            } catch (err) {
                console.error(`[WaveManager] Erreur de spawn:`, err);
            }
        } else if (enemies.length >= maxEnemies) {
            this.spawnQueue = 0; // Clear queue if at max cap
        }
    }
}

