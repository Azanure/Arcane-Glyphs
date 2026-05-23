export class InputManager {
    constructor() {
        this.keys  = {};   // Touche par e.code (position physique)
        this.chars = {};   // Touche par e.key en minuscule (caractère affiché)

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.key && e.key.length === 1) {
                this.chars[e.key.toLowerCase()] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.key && e.key.length === 1) {
                this.chars[e.key.toLowerCase()] = false;
            }
        });
    }

    /** Teste une touche par son code physique (e.code) */
    isKeyPressed(keyCode) {
        return this.keys[keyCode] === true;
    }

    /** Teste une touche par son caractère affiché (e.key, insensible à la casse) */
    isCharPressed(char) {
        return this.chars[char.toLowerCase()] === true;
    }
}