/**
 * SeededRandom.js
 * Générateur de nombres pseudo-aléatoires déterministe (algorithme xorshift32).
 * Utilisé partout dans le jeu pour garantir la reproductibilité d'une partie via seed.
 *
 * Usage :
 *   const rng = new SeededRandom(12345);
 *   rng.next();        // float dans [0, 1)
 *   rng.nextInt(n);    // entier dans [0, n)
 *   rng.nextRange(a,b) // float dans [a, b)
 */
export class SeededRandom {
    /**
     * @param {number} seed - Entier utilisé comme graine (32 bits)
     */
    constructor(seed) {
        // On garantit que la seed est un entier 32 bits non-nul
        this.seed = (seed | 0) || 0xdeadbeef;
        this._state = this.seed;
    }

    /** Retourne un nombre pseudo-aléatoire dans [0, 1) */
    next() {
        // xorshift32
        let x = this._state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this._state = x;
        // Normaliser en positif et ramener dans [0,1)
        return ((x >>> 0) / 0x100000000);
    }

    /** Retourne un entier pseudo-aléatoire dans [0, n) */
    nextInt(n) {
        return Math.floor(this.next() * n);
    }

    /** Retourne un float pseudo-aléatoire dans [min, max) */
    nextRange(min, max) {
        return min + this.next() * (max - min);
    }

    /** Mélange un tableau sur place (Fisher-Yates avec cette seed) */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.nextInt(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
