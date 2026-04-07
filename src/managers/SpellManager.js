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

    castSpell(spellConfig, player, enemies) {
        // Enregistrer l'utilisation de l'élément par le joueur pour l'IA
        if (spellConfig.element) {
            player.recordSpellUsage(spellConfig.element);
        } else {
            // Optionnel : si on considère l'effet "dmg" ou les sous-effets
            let primaryElement = spellConfig.effects[0] ? spellConfig.effects[0].element : "NONE";
            player.recordSpellUsage(primaryElement || "NONE");
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
                this.applyEffects.bind(this)
            );
        } else {
            console.warn(`Comportement inconnu pour le sort: ${spellConfig.castType}`);
        }
    }

    applyEffects(enemy, effects) {
        for (let baseEffect of effects) {
            if (baseEffect.type === "DAMAGE") {
                let dmg = baseEffect.amount;
                let elem = baseEffect.element;
                let shouldDamage = true;

                if (elem === "FIRE") {
                    if (enemy.elementType === "fire") dmg = 0;
                    else if (enemy.elementType === "earth") dmg *= 0.5;
                } else if (elem === "ICE") {
                    if (enemy.elementType === "ice") {
                        enemy.heal(dmg * 0.2); // Original was 10 heal for 50 damage
                        shouldDamage = false;
                    } else if (enemy.elementType === "fire") {
                        dmg *= 0.5; // Original was 25 dmg for 50 damage
                    }
                } else if (elem === "EARTH") {
                    if (enemy.elementType === "earth") dmg *= 0.5;
                    else if (enemy.elementType === "ice") dmg *= 0.2; // Original was 10 dmg for 50 damage
                }

                if (shouldDamage && dmg > 0) enemy.takeDamage(dmg);
            } else if (baseEffect.type === "FREEZE") {
                if (enemy.elementType !== 'ice') {
                    enemy.applyFreeze(baseEffect.duration);
                }
            } else if (baseEffect.type === "SLOW") {
                if (enemy.elementType !== 'earth') {
                    // Original didn't specifically read factor natively but it was hardcoded or implemented in applySlow
                    enemy.applySlow(baseEffect.duration);
                }
            }
        }
    }
}
