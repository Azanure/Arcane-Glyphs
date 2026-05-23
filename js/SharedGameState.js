/**
 * SharedGameState — Données joueur qui persistent entre les scènes (Hub ↔ Level).
 * Ce fichier ne doit contenir AUCUNE référence à Babylon.js.
 */
export class SharedGameState {
    constructor() {
        this.selectedCharacterName = 'brand';
        this._reset();
    }

    /** Réinitialise toutes les stats joueur (appelé au retour au Hub) */
    reset() {
        const savedChar = this.selectedCharacterName;
        this._reset();
        this.selectedCharacterName = savedChar; // conserve le perso choisi
    }

    _reset() {
        // --- Stats joueur ---
        this.playerHp             = 100;
        this.playerMaxHp          = 100;
        this.playerXp             = 0;
        this.playerLevel          = 1;
        this.playerXpToNextLevel  = 10;
        this.playerDamage         = 25;
        this.playerSpeed          = 0.1;
        this.playerShootCooldown  = 1000;
        this.playerHpRegen        = 0;
        this.playerXpRadius       = 10;
        this.upgradeLevels        = {};
        this.spellLevels          = {};
    }
}
