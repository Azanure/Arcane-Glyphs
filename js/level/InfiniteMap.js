import { TerrainChunk, CHUNK_SIZE, TILE_SIZE } from './TerrainChunk.js';
import { LakeGenerator, PitGenerator } from '../math/LakeGenerator.js';

export class InfiniteMap {
    constructor(scene) {
        this.scene = scene;
        this.activeChunks = new Map();
        // Utiliser la seed du niveau pour un terrain déterministe
        const seed = window.levelSeed ?? 42;
        this.noiseGen = new LakeGenerator(seed);
        this.pitGen = new PitGenerator(seed);
        this.renderDistance = 1;

        this.lastPlayerChunkX = -999;
        this.lastPlayerChunkZ = -999;

        // Exposer globalement pour la détection lave/trou O(1) dans Player.js et Enemy.js
        window.terrainNoiseGen = this.noiseGen;
        window.terrainPitGen = this.pitGen;

        this.chunkQueue = [];
    }

    /**
     * S'assure que le joueur spawn sur une case de sol valide.
     */
    ensureSafeSpawn(player) {
        let px = Math.floor(player.mesh.position.x / TILE_SIZE);
        let pz = Math.floor(player.mesh.position.z / TILE_SIZE);

        // Scan en spirale autour de la position actuelle pour trouver du SOL
        const range = 15;
        for (let r = 0; r < range; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    const worldX = px + dx;
                    const worldZ = pz + dz;

                    // On simule getNoiseAt sans instancier le chunk
                    const isLava = this.noiseGen.isLava(worldX, worldZ);
                    const isPit = this.pitGen.isPit(worldX, worldZ);

                    if (!isLava && !isPit) {
                        player.mesh.position.x = worldX * TILE_SIZE + (TILE_SIZE / 2);
                        player.mesh.position.z = worldZ * TILE_SIZE + (TILE_SIZE / 2);
                        player.mesh.position.y = 1.5; // Le sol est à Y=1, on spawn juste un peu au dessus pour tomber dessus proprement
                        console.log(`[SPAWN] Position safe trouvée à : ${player.mesh.position}`);
                        return;
                    }
                }
            }
        }
    }

    update(playerPosition) {
        // En vrai taille d'un chunk, TILE_SIZE * CHUNK_SIZE = 32
        const chunkSizeWorld = CHUNK_SIZE * TILE_SIZE;

        let pChunkX = this.lastPlayerChunkX;
        let pChunkZ = this.lastPlayerChunkZ;

        // --- OPTIMISATION COLLISIONS (Étape 2) ---
        // On le fait à chaque frame pour activer/désactiver les collisions au plus proche (rayon de 15m)
        for (let [key, chunk] of this.activeChunks) {
            chunk.updateCollisions(playerPosition, 15);
        }

        // --- GÉNÉRATION PROGRESSIVE (1 chunk par frame pour éviter les lag spikes) ---
        if (this.chunkQueue.length > 0) {
            let key = this.chunkQueue.shift();
            // Double vérification si on en a toujours besoin
            if (!this.activeChunks.has(key)) {
                let parts = key.split('_');
                let cx = parseInt(parts[0]);
                let cz = parseInt(parts[1]);
                let newChunk = new TerrainChunk(cx, cz, this.noiseGen, this.pitGen, this.scene);
                this.activeChunks.set(key, newChunk);
            }
        }

        // --- HYSTÉRÉSIS (Zone tampon de 20m) ---
        // Évite le "thrashing" aux frontières de chunk
        let currentCenterX = (this.lastPlayerChunkX * chunkSizeWorld) + (chunkSizeWorld / 2);
        let currentCenterZ = (this.lastPlayerChunkZ * chunkSizeWorld) + (chunkSizeWorld / 2);

        let distToCenterSq =
            Math.pow(playerPosition.x - currentCenterX, 2) +
            Math.pow(playerPosition.z - currentCenterZ, 2);

        // Si c'est le tout premier appel ou si on est sorti de la zone sécurisée (20m)
        if (this.lastPlayerChunkX === -999 || distToCenterSq > Math.pow(20.0, 2)) {
            pChunkX = Math.floor(playerPosition.x / chunkSizeWorld);
            pChunkZ = Math.floor(playerPosition.z / chunkSizeWorld);
        }

        // Si le joueur est resté dans la zone sécurisée, on ne recalcule pas la génération
        if (pChunkX === this.lastPlayerChunkX && pChunkZ === this.lastPlayerChunkZ) return;

        this.lastPlayerChunkX = pChunkX;
        this.lastPlayerChunkZ = pChunkZ;

        let neededChunks = [];

        // Identifier les chunks requis
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                // Créer une forme de cercle rudimentaire ou carré (on fait un carré ici)
                neededChunks.push(`${pChunkX + x}_${pChunkZ + z}`);
            }
        }

        // Supprimer les chunks lointains
        for (let [key, chunk] of this.activeChunks) {
            if (!neededChunks.includes(key)) {
                chunk.dispose();
                this.activeChunks.delete(key);
            }
        }

        // Générer les nouveaux chunks (ajout à la file d'attente)
        for (let key of neededChunks) {
            if (!this.activeChunks.has(key) && !this.chunkQueue.includes(key)) {
                this.chunkQueue.push(key);
            }
        }
    }
}
