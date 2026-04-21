import { TerrainChunk, CHUNK_SIZE, TILE_SIZE } from './TerrainChunk.js';
import { LakeGenerator, PitGenerator } from '../math/LakeGenerator.js';

export class InfiniteMap {
    constructor(scene) {
        this.scene = scene;
        this.activeChunks = new Map();
        this.noiseGen = new LakeGenerator(42); // Seed globale demandée
        this.pitGen = new PitGenerator(42);   // Nouveau générateur de trous
        this.renderDistance = 2; // Nombre de chunks autour du joueur
        
        this.lastPlayerChunkX = -999;
        this.lastPlayerChunkZ = -999;

        // --- SOL DE SÉCURITÉ ---
        // Une grande plaque invisible qui suit le joueur pour empêcher de tomber
        this.safetyFloor = BABYLON.MeshBuilder.CreateGround("safetyFloor", { width: 100, height: 100 }, this.scene);
        this.safetyFloor.isVisible = false; 
        this.safetyFloor.checkCollisions = true; 
        this.safetyFloor.position.y = -0.05; 
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
                        player.mesh.position.y = 1.0; 
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
        
        let pChunkX = Math.floor(playerPosition.x / chunkSizeWorld);
        let pChunkZ = Math.floor(playerPosition.z / chunkSizeWorld);

        // Si le joueur est resté dans le même chunk, on ne recalcule rien
        if (pChunkX === this.lastPlayerChunkX && pChunkZ === this.lastPlayerChunkZ) return;

        this.lastPlayerChunkX = pChunkX;
        this.lastPlayerChunkZ = pChunkZ;

        // Le sol de sécurité suit le joueur
        this.safetyFloor.position.x = pChunkX * chunkSizeWorld;
        this.safetyFloor.position.z = pChunkZ * chunkSizeWorld;

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

        // Générer les nouveaux chunks
        for (let key of neededChunks) {
            if (!this.activeChunks.has(key)) {
                let parts = key.split('_');
                let cx = parseInt(parts[0]);
                let cz = parseInt(parts[1]);
                let newChunk = new TerrainChunk(cx, cz, this.noiseGen, this.pitGen, this.scene);
                this.activeChunks.set(key, newChunk);
            }
        }
    }
}
