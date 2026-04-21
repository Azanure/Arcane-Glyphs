/**
 * TilePicker.js
 * Détermine quelle tuile instancier et quelle rotation appliquer selon les voisins (Bitmasking).
 */

export class TilePicker {
    /**
     * @param {number} type - 0 pour Lave, 1 pour Sol
     * @param {number} top - type du voisin haut
     * @param {number} right - type du voisin droite
     * @param {number} bottom - type du voisin bas
     * @param {number} left - type du voisin gauche
     * @returns {Object} { name: "nom_du_mesh", rotation: rad }
     */
    static getTile(type, top, right, bottom, left, cx, cz) {
        let mask = 0;
        if (top === type) mask += 1;    // N
        if (right === type) mask += 2;  // E
        if (bottom === type) mask += 4; // S
        if (left === type) mask += 8;   // W

        const PI = Math.PI;
        let tileName = "";
        let rotation = 0;

        const isB = (Math.abs(Math.sin(cx * 12.9898 + cz * 78.233)) * 43758.5453 % 1) > 0.5;

        if (type === 1) { // --- SOIL ---
            if (mask === 15) return { name: "soil_middle", rotation: 0 };
            return { name: isB ? "soil_clean_B" : "soil_clean_A", rotation: 0 };
        } 
        else { // --- LAVA ---
            // On se base sur le fait que lava_pit_middle a de la terre sur UN côté (par défaut au NORD/Top ?)
            // Si mask=14, le Nord est de la TERRE (car le bit 1 est à 0 dans mask 14)
            // Attendez, mon mask calculé au dessus : if (top === type [0]) mask += 1.
            // Donc si top est LAVA (0), mask possède le bit 1.
            // Si mask=14 (1110), Top est SOIL (1).
            
            switch(mask) {
                case 15: // Centre total
                    tileName = "lava_pit_lava"; break;
                
                // BORDS DROITS (1 voisin terre)
                case 14: // Terre au Nord
                    tileName = isB ? "lava_pit_middle_B" : "lava_pit_middle_A"; rotation = 0; break;
                case 13: // Terre à l'Est
                    tileName = isB ? "lava_pit_middle_B" : "lava_pit_middle_A"; rotation = PI/2; break;
                case 11: // Terre au Sud
                    tileName = isB ? "lava_pit_middle_B" : "lava_pit_middle_A"; rotation = PI; break;
                case 7: // Terre à l'Ouest
                    tileName = isB ? "lava_pit_middle_B" : "lava_pit_middle_A"; rotation = -PI/2; break;

                // COINS EXTERNES (2 voisins terre orthogonaux)
                // Ex: mask 12 (1100) -> N et E sont SOIL.
                case 12: tileName = "lava_pit_corner"; rotation = 0; break;
                case 9:  tileName = "lava_pit_corner"; rotation = PI/2; break;
                case 3:  tileName = "lava_pit_corner"; rotation = PI; break;
                // COINS INTERNES (1 seul voisin lave)
                case 1: tileName = isB ? "lava_pit_inner_corner_B" : "lava_pit_inner_corner_A"; rotation = 0; break;
                case 2: tileName = isB ? "lava_pit_inner_corner_B" : "lava_pit_inner_corner_A"; rotation = PI/2; break;
                case 4: tileName = isB ? "lava_pit_inner_corner_B" : "lava_pit_inner_corner_A"; rotation = PI; break;
                case 8: tileName = isB ? "lava_pit_inner_corner_B" : "lava_pit_inner_corner_A"; rotation = -PI/2; break;

                default:
                    tileName = "lava_pit"; break;
            }
        }
        return { name: tileName, rotation: rotation };
    }
}
