/**
 * SpatialHashGrid — Grille de hash spatiale pour accélérer les requêtes de proximité
 * entre ennemis (separation force).
 *
 * Principe :
 *   - Le monde est divisé en cellules de taille `cellSize`.
 *   - Chaque entité est hashée vers une cellule en fonction de sa position.
 *   - Pour trouver les voisins d'une entité, on ne consulte que les 9 cellules
 *     autour d'elle (au lieu de tous les ennemis).
 *
 * Complexité : O(n) pour la reconstruction, O(1) moyen pour les requêtes.
 */
export class SpatialHashGrid {
    /**
     * @param {number} cellSize - Taille d'une cellule en unités monde (doit être >= rayon de séparation)
     */
    constructor(cellSize = 3) {
        this.cellSize = cellSize;
        /** @type {Map<string, object[]>} */
        this.cells = new Map();
    }

    /** Convertit une coordonnée monde en index de cellule */
    _cellKey(x, z) {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        return `${cx},${cz}`;
    }

    /**
     * Reconstruit la grille à partir du tableau d'entités.
     * À appeler une fois par frame, AVANT les mises à jour d'ennemis.
     * @param {object[]} entities - Tableau d'ennemis avec une propriété `.mesh.position`
     */
    rebuild(entities) {
        this.cells.clear();
        for (const entity of entities) {
            if (entity.isDead || !entity.mesh) continue;
            const key = this._cellKey(entity.mesh.position.x, entity.mesh.position.z);
            if (!this.cells.has(key)) this.cells.set(key, []);
            this.cells.get(key).push(entity);
        }
    }

    /**
     * Retourne tous les voisins d'une entité dans un rayon donné.
     * Consulte uniquement les 9 cellules voisines.
     * @param {object} entity - L'entité dont on cherche les voisins
     * @param {number} radius - Rayon de recherche (doit être <= cellSize pour être exact)
     * @returns {object[]} Liste des entités voisines (sans l'entité elle-même)
     */
    queryNearby(entity, radius) {
        const px = entity.mesh.position.x;
        const pz = entity.mesh.position.z;
        const cx = Math.floor(px / this.cellSize);
        const cz = Math.floor(pz / this.cellSize);

        const results = [];
        const radiusSq = radius * radius;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = `${cx + dx},${cz + dz}`;
                const cell = this.cells.get(key);
                if (!cell) continue;
                for (const other of cell) {
                    if (other === entity || other.isDead) continue;
                    const distSq =
                        (other.mesh.position.x - px) ** 2 +
                        (other.mesh.position.z - pz) ** 2;
                    if (distSq < radiusSq) {
                        results.push(other);
                    }
                }
            }
        }

        return results;
    }
}
