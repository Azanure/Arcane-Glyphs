export class WaveManager {
    constructor() {
        this.baseWeights = {
            FIRE: 1000,
            ICE: 1000,
            EARTH: 1000
        };

        // Décroissance exponentielle (facteurs de multiplication par utilisation)
        // ex: 0.50 = perd 50% de probabilité de spawn à chaque fois qu'un sort est casté !
        this.decayMatrix = {
            FIRE:  { FIRE: 0.9, ICE: 0.50, EARTH: 1.0 },   // Joueur utilise FEU -> tend vers TERRE (Baisse GLACE ultra vite, FEU vite)
            EARTH: { FIRE: 0.50, ICE: 1.0,  EARTH: 0.90 },  // Joueur utilise TERRE -> tend vers GLACE (Baisse FEU ultra vite, TERRE vite)
            ICE:   { FIRE: 0.9,  ICE: 1.0, EARTH: 0.65 },  // Joueur utilise GLACE -> tend vers FEU (Baisse TERRE et GLACE de manière égale)
            NONE:  { FIRE: 1.0,  ICE: 1.0,  EARTH: 1.0 }
        };

        this.lastTypeSpawned = null;
    }

    getSpawnProbabilities(player) {
        let playerStats = player.elementStats;

        let dynamicWeights = {
            FIRE: this.baseWeights.FIRE 
                  * Math.pow(this.decayMatrix.FIRE.FIRE, playerStats.FIRE) 
                  * Math.pow(this.decayMatrix.EARTH.FIRE, playerStats.EARTH) 
                  * Math.pow(this.decayMatrix.ICE.FIRE, playerStats.ICE),
                  
            ICE: this.baseWeights.ICE 
                 * Math.pow(this.decayMatrix.FIRE.ICE, playerStats.FIRE) 
                 * Math.pow(this.decayMatrix.EARTH.ICE, playerStats.EARTH) 
                 * Math.pow(this.decayMatrix.ICE.ICE, playerStats.ICE),
                 
            EARTH: this.baseWeights.EARTH 
                   * Math.pow(this.decayMatrix.FIRE.EARTH, playerStats.FIRE) 
                   * Math.pow(this.decayMatrix.EARTH.EARTH, playerStats.EARTH) 
                   * Math.pow(this.decayMatrix.ICE.EARTH, playerStats.ICE)
        };

        // On abaisse le seuil minimum à 0.001. 
        // Cela évite "l'effet rebond" : si tout était bloqué à 5, les % revenaient à 33%.
        // Avec un seuil très bas, un élément non-utilisé va royalement dominer les autres s'ils ont été joués.
        dynamicWeights.FIRE = Math.max(0.001, dynamicWeights.FIRE);
        dynamicWeights.ICE = Math.max(0.001, dynamicWeights.ICE);
        dynamicWeights.EARTH = Math.max(0.001, dynamicWeights.EARTH);

        if (this.lastTypeSpawned) {
            dynamicWeights[this.lastTypeSpawned] *= 0.5; // Divise par 2 les chances du même type de s'enchaîner
        }

        let totalWeight = dynamicWeights.FIRE + dynamicWeights.ICE + dynamicWeights.EARTH;
        
        return {
            FIRE: dynamicWeights.FIRE,
            ICE: dynamicWeights.ICE,
            EARTH: dynamicWeights.EARTH,
            totalWeight: totalWeight
        };
    }

    spawnEnemy(player) {
        let probabilities = this.getSpawnProbabilities(player);

        let randomVal = Math.random() * probabilities.totalWeight;

        let spawnType = null;
        if (randomVal < probabilities.FIRE) {
            spawnType = 'FIRE';
        } else if (randomVal < probabilities.FIRE + probabilities.ICE) {
            spawnType = 'ICE';
        } else {
            spawnType = 'EARTH';
        }

        this.lastTypeSpawned = spawnType;
        
        return spawnType;
    }
}
