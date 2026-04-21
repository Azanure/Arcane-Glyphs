/**
 * A fast javascript implementation of simplex noise by Jonas Wagner
 * Adapté pour le projet Arcane Glyphs.
 */

export class NoiseGenerator {
    constructor(seed = 1) {
        this.p = new Uint8Array(256);
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        this.seed(seed);
    }

    seed(seed) {
        if(seed > 0 && seed < 1) {
            seed = seed * 65536;
        }
        
        seed = Math.floor(seed);
        if(seed < 256) {
            seed |= seed << 8;
        }
        
        // Simple seeded random function
        let r = seed;
        const random = function() {
            r ^= r << 13;
            r ^= r >> 17;
            r ^= r << 5;
            return (r < 0 ? ~r + 1 : r) % 256;
        };

        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }
        
        for (let i = 0; i < 256; i++) {
            let r_idx = random();
            let temp = this.p[i];
            this.p[i] = this.p[r_idx];
            this.p[r_idx] = temp;
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = (this.perm[i] % 12);
        }
    }

    noise2D(xin, yin) {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        let n0, n1, n2; // Noise contributions from the three corners
        // Skew the input space to determine which simplex cell we're in
        let s = (xin + yin) * F2; // Hairy factor for 2D
        let i = Math.floor(xin + s);
        let j = Math.floor(yin + s);
        let t = (i + j) * G2;
        let X0 = i - t; // Unskew the cell origin back to (x,y) space
        let Y0 = j - t;
        let x0 = xin - X0; // The x,y distances from the cell origin
        let y0 = yin - Y0;
        // For the 2D case, the simplex shape is an equilateral triangle.
        // Determine which simplex we are in.
        let i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
        if(x0 > y0) {i1=1; j1=0;} // lower triangle, XY order: (0,0)->(1,0)->(1,1)
        else {i1=0; j1=1;}      // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
        // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
        // c = (3-sqrt(3))/6
        let x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
        let y1 = y0 - j1 + G2;
        let x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
        let y2 = y0 - 1.0 + 2.0 * G2;
        // Work out the hashed gradient indices of the three simplex corners
        let ii = i & 255;
        let jj = j & 255;
        let gi0 = this.permMod12[ii + this.perm[jj]];
        let gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
        let gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
        // Calculate the contribution from the three corners
        let t0 = 0.5 - x0*x0-y0*y0;
        if(t0 < 0) n0 = 0.0;
        else {
            t0 *= t0;
            n0 = t0 * t0 * this.dot(gi0, x0, y0);  // (x,y) of grad3 used for 2D gradient
        }
        let t1 = 0.5 - x1*x1-y1*y1;
        if(t1 < 0) n1 = 0.0;
        else {
            t1 *= t1;
            n1 = t1 * t1 * this.dot(gi1, x1, y1);
        }
        let t2 = 0.5 - x2*x2-y2*y2;
        if(t2 < 0) n2 = 0.0;
        else {
            t2 *= t2;
            n2 = t2 * t2 * this.dot(gi2, x2, y2);
        }
        // Add contributions from each corner to get the final noise value.
        // The result is scaled to return values in the interval [-1,1].
        return 70.0 * (n0 + n1 + n2);
    }

    dot(g, x, y) {
        const grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        return grad3[g][0]*x + grad3[g][1]*y;
    }
}
