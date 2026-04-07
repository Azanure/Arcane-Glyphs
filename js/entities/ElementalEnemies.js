import { Enemy } from './Enemy.js';

export class FireEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        super(scene, playerPos, radius, new BABYLON.Color3(1, 0, 0));
        this.elementType = 'fire';
    }
}

export class IceEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        super(scene, playerPos, radius, new BABYLON.Color3(0, 0.4, 1));
        this.elementType = 'ice';
    }
}

export class EarthEnemy extends Enemy {
    constructor(scene, playerPos, radius) {
        super(scene, playerPos, radius, new BABYLON.Color3(0.6, 0.3, 0));
        this.elementType = 'earth';
    }
}
