import { ElementDatabase } from '../configs/ElementDatabase.js';
import { SpellDatabase } from '../configs/SpellDatabase.js';

class LoadoutManager {
    constructor() {
        this.maxElements = 4;
        this.equippedElements = new Set();
        this.runeSpells = {}; // mapping runeId -> spellCode object
    }

    equipElement(elementId) {
        if (this.equippedElements.size < this.maxElements && !this.equippedElements.has(elementId)) {
            this.equippedElements.add(elementId);
            return true;
        }
        return false;
    }

    unequipElement(elementId) {
        if (this.equippedElements.has(elementId)) {
            this.equippedElements.delete(elementId);
            
            // On déséquipe automatiquement les sorts de cet élément
            this.clearSpellsOfElement(elementId);
            return true;
        }
        return false;
    }

    clearSpellsOfElement(elementId) {
        for (let runeId in this.runeSpells) {
            const spell = this.runeSpells[runeId];
            if (spell && spell.element === elementId) {
                this.runeSpells[runeId] = null;
            }
        }
    }

    assignSpellToRune(spellId, runeId) {
        const spell = SpellDatabase[spellId];
        if (!spell) return false;

        // On vérifie que l'élément parent est bien équipé
        if (!this.equippedElements.has(spell.element)) {
            console.warn(`[Loadout] Impossible d'équiper ${spellId} : son élément ${spell.element} n'est pas actif.`);
            return false;
        }

        // On déséquipe le sort s'il est déjà assigné à une autre rune
        for (let rId in this.runeSpells) {
            if (this.runeSpells[rId] && this.runeSpells[rId].id === spellId) {
                this.runeSpells[rId] = null;
            }
        }

        this.runeSpells[runeId] = spell;
        return true;
    }

    unassignRune(runeId) {
        this.runeSpells[runeId] = null;
    }

    getEquippedElements() {
        return Array.from(this.equippedElements).map(id => ElementDatabase[id]);
    }

    getSpellsForRune(runeId) {
        return this.runeSpells[runeId] || null;
    }

    getLoadout() {
        return {
            elements: this.getEquippedElements(),
            bindings: { ...this.runeSpells }
        };
    }
}

export const loadoutManager = new LoadoutManager();
window.loadoutManager = loadoutManager;
