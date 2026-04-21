/**
 * LakeGenerator.js
 * Génère des amas de lave de taille limitée (max 16) de manière déterministe.
 */

export class LakeGenerator {
    constructor(seed = 123) {
        this.globalSeed = seed;
        this.zoneSize = 12; // Chaque 12x12 unités, on peut avoir un lac
        this.cache = new Map(); // Cache simple pour les zones déjà calculées
    }

    // Simple hash function for deterministic results
    hash(x, z) {
        // Ajout d'une constante de mixage pour éviter les répétitions à 0,0
        let h = (x * 374761393 ^ z * 668265263) + this.globalSeed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return (h ^ (h >>> 16)) >>> 0;
    }

    getLakeAtZone(zi, zj) {
        const key = `${zi}_${zj}`;
        if (this.cache.has(key)) return this.cache.get(key);

        // FORCAGE : Toujours un lac à (0,0) pour le test
        if (zi === 0 && zj === 0) {
            // Pas de redirection, on continue pour générer le lac
        } else {
            const h = this.hash(zi, zj);
            // 40% de chance
            if ((h % 100) > 40) {
                this.cache.set(key, null);
                return null;
            }
        }

        const h = this.hash(zi, zj);
        // Taille déterministe entre 2 et 5 tiles (moyenne plus basse)
        const width = 2 + (h % 4);
        const height = 2 + ((h >>> 8) % 4);

        const centerX = Math.floor(zi * this.zoneSize + (this.zoneSize - width) / 2);
        const centerZ = Math.floor(zj * this.zoneSize + (this.zoneSize - height) / 2);

        const lakeTiles = new Set();
        for (let x = 0; x < width; x++) {
            for (let z = 0; z < height; z++) {
                lakeTiles.add(`${centerX + x}_${centerZ + z}`);
            }
        }

        const result = { center: {x: centerX, z: centerZ}, tiles: lakeTiles };
        this.cache.set(key, result);
        return result;
    }

    isLava(worldX, worldZ) {
        // Pour savoir si cette coordonnée est de la lave, 
        // on regarde les zones environnantes (puisqu'un lac peut dépasser sa zone)
        const zi = Math.floor(worldX / this.zoneSize);
        const zj = Math.floor(worldZ / this.zoneSize);
        
        const targetKey = `${worldX}_${worldZ}`;

        // On check un voisinage de 1 zone autour (suffit car volume max 16)
        for(let ni = zi - 1; ni <= zi + 1; ni++) {
            for(let nj = zj - 1; nj <= zj + 1; nj++) {
                const lake = this.getLakeAtZone(ni, nj);
                if (lake && lake.tiles.has(targetKey)) {
                    return true;
                }
            }
        }

        return false;
    }
}

/**
 * PitGenerator.js
 * Génère des amas de TROUS de manière organique (flood-fill).
 */
export class PitGenerator {
    constructor(seed = 123) {
        this.globalSeed = seed + 999; // Offset pour éviter de chevaucher la lave
        this.zoneSize = 12;
        this.cache = new Map();
    }

    hash(x, z) {
        let h = (x * 374761393 ^ z * 668265263) + this.globalSeed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return (h ^ (h >>> 16)) >>> 0;
    }

    getPitAtZone(zi, zj) {
        const key = `${zi}_${zj}`;
        if (this.cache.has(key)) return this.cache.get(key);

        const h = this.hash(zi, zj);
        // 50% de chance de spawn de trou (Augmenté)
        if ((h % 100) > 50) {
            this.cache.set(key, null);
            return null;
        }

        const maxVolume = 6 + (h % 11); // 6 à 16 tiles
        const centerX = Math.floor(zi * this.zoneSize + (h % this.zoneSize));
        const centerZ = Math.floor(zj * this.zoneSize + ((h >>> 8) % this.zoneSize));

        const pitTiles = new Set();
        const queue = [{x: centerX, z: centerZ}];
        pitTiles.add(`${centerX}_${centerZ}`);

        let localH = h;
        while (pitTiles.size < maxVolume && queue.length > 0) {
            const index = (localH >>> 4) % queue.length;
            const current = queue[index];
            localH = Math.imul(localH, 1103515245) + 12345 >>> 0;

            const neighbors = [
                {x: current.x + 1, z: current.z},
                {x: current.x - 1, z: current.z},
                {x: current.x, z: current.z + 1},
                {x: current.x, z: current.z - 1}
            ];
            neighbors.sort(() => ((localH >>> 12) % 100) - 50);

            for(let n of neighbors) {
                const nKey = `${n.x}_${n.z}`;
                if (!pitTiles.has(nKey) && pitTiles.size < maxVolume) {
                    pitTiles.add(nKey);
                    queue.push(n);
                }
            }
        }

        const result = { center: {x: centerX, z: centerZ}, tiles: pitTiles };
        this.cache.set(key, result);
        return result;
    }

    isPit(worldX, worldZ) {
        const zi = Math.floor(worldX / this.zoneSize);
        const zj = Math.floor(worldZ / this.zoneSize);
        const targetKey = `${worldX}_${worldZ}`;

        for(let ni = zi - 1; ni <= zi + 1; ni++) {
            for(let nj = zj - 1; nj <= zj + 1; nj++) {
                const pit = this.getPitAtZone(ni, nj);
                if (pit && pit.tiles.has(targetKey)) {
                    return true;
                }
            }
        }
        return false;
    }
}
