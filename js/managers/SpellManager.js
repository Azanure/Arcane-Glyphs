import { SpellDatabase } from '../configs/SpellDatabase.js';
import { SpellBehaviors } from './SpellBehaviors.js';

export class SpellManager {
    constructor(scene) {
        this.scene = scene;
        this.cooldowns = {};
        this.bindings = [];
    }

    bindSpells(bindings) {
        this.bindings = bindings;
    }

    findBestTargetGroup(player, enemies) {
        if (!enemies || enemies.length === 0) return null;

        let bestTarget = null;
        let highestScore = -Infinity;

        for (let enemy of enemies) {
            if (enemy.isDead) continue;
            
            let distToPlayer = BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position);
            if (distToPlayer === 0) continue; 
            
            let friendsNearby = 0;
            for (let other of enemies) {
                if (other.isDead) continue;
                if (BABYLON.Vector3.Distance(enemy.mesh.position, other.mesh.position) <= 5) {
                    friendsNearby++;
                }
            }
            
            let score = friendsNearby / distToPlayer;
            if (score > highestScore) {
                highestScore = score;
                bestTarget = enemy;
            }
        }

        return bestTarget;
    }

    update(inputManager, player, enemies) {
        if (player.isDead) return;
        let currentTime = window.gameTime;

        for (const { key, spellCode } of this.bindings) {
            if (inputManager.isKeyPressed(key)) {
                let lastTime = this.cooldowns[spellCode.id] || 0;
                let cooldownMs = spellCode.cooldown * 1000;
                if (currentTime - lastTime >= cooldownMs) {
                    this.castSpell(spellCode, player, enemies);
                    this.cooldowns[spellCode.id] = currentTime;
                }
            }
        }
    }

    castSpell(spellConfig, player, enemies, targetDirection = null) {
        // Enregistrer l'utilisation de l'élément par le joueur pour l'IA
        let castElement = spellConfig.element || (spellConfig.effects[0] ? spellConfig.effects[0].element : "NONE");
        player.recordSpellUsage(castElement);

        if (castElement !== "NONE" && window.globalResistances && window.globalResistances[castElement] !== undefined) {
            window.globalResistances[castElement] = Math.min(1.0, window.globalResistances[castElement] + 0.01);
            Object.keys(window.globalResistances).forEach(el => {
                if (el !== castElement) {
                    window.globalResistances[el] = Math.max(0.0, window.globalResistances[el] - 0.02);
                }
            });
            if (window.updateResistanceUI) window.updateResistanceUI();
        }

        // Trouver la cible requise pour certains sorts
        let target = this.findBestTargetGroup(player, enemies);

        // Vérifier si le comportement visuel existe pour ce castType
        const behavior = SpellBehaviors[spellConfig.castType];
        
        if (behavior) {
            // On délègue toute la logique 3D au fichier externe
            behavior(
                this.scene, 
                spellConfig, 
                player, 
                enemies, 
                target, 
                (enemy, effects) => this.applyEffects(enemy, effects, spellConfig, player),
                targetDirection
            );
        } else {
            console.warn(`Comportement inconnu pour le sort: ${spellConfig.castType}`);
        }
    }

    applyEffects(enemy, effects, spellConfig, player) {
        let playerDamage = player ? player.damage : 0;
        let damageMult = spellConfig.damageMult || 1;

        if (player && player.selectedCharacterName) {
            const charName = player.selectedCharacterName.toLowerCase();
            if (charName === 'brand' && spellConfig.element === 'FIRE') {
                damageMult *= 1.5;
            } else if (charName === 'azir' && spellConfig.element === 'AIR') {
                damageMult *= 1.5;
            }
        }

        for (let baseEffect of effects) {
            let res = 0;
            if (baseEffect.element && window.globalResistances) {
                res = window.globalResistances[baseEffect.element] || 0;
            }

            if (baseEffect.type === "DAMAGE") {
                let dmg = (baseEffect.amount + playerDamage) * damageMult * (1 - res);
                if (dmg > 0) enemy.takeDamage(dmg);
            } else if (baseEffect.type === "FREEZE") {
                let duration = baseEffect.duration * (1 - res);
                if (duration > 0) enemy.applyFreeze(duration);
            } else if (baseEffect.type === "SLOW") {
                let duration = baseEffect.duration * (1 - res);
                if (duration > 0) enemy.applySlow(duration);
            }
        }
    }
}
