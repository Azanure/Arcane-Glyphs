export const SpellUpgradesDatabase = {
    FIREBALL: [
        {
            level: 2,
            title: "Inferno Heat",
            description: "+25% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.25;
            }
        },
        {
            level: 3,
            title: "Twin Flames",
            description: "+1 Projectile",
            apply: (spell) => {
                spell.projectiles = (spell.projectiles || 1) + 1;
            }
        },
        {
            level: 4,
            title: "Volcanic Radius",
            description: "+30% Area of Effect",
            apply: (spell) => {
                spell.radius = (spell.radius || 5) * 1.3;
            }
        },
        {
            level: 5,
            title: "Dragon's Breath",
            description: "+1 Projectile & +50% Damage",
            apply: (spell) => {
                spell.projectiles = (spell.projectiles || 1) + 1;
                spell.damageMult = (spell.damageMult || 1) + 0.50;
            }
        }
    ],
    INFERNO: [
        {
            level: 2,
            title: "Scorching Heat",
            description: "+25% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.25;
            }
        },
        {
            level: 3,
            title: "Expanding Flames",
            description: "+30% Area of Effect",
            apply: (spell) => {
                spell.radius = (spell.radius || 6) * 1.3;
            }
        },
        {
            level: 4,
            title: "Intense Burn",
            description: "-3s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(1, (spell.cooldown || 15) - 3);
            }
        },
        {
            level: 5,
            title: "Core of the Volcano",
            description: "+50% Damage & +30% Area of Effect",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.radius = (spell.radius || 6) * 1.3;
            }
        }
    ],
    FIRE_BOMB: [
        {
            level: 2,
            title: "Volatile Powder",
            description: "+30% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.30;
            }
        },
        {
            level: 3,
            title: "Shrapnel Explosion",
            description: "+30% Area of Effect",
            apply: (spell) => {
                spell.radius = (spell.radius || 4) * 1.3;
            }
        },
        {
            level: 4,
            title: "Quick Fuse",
            description: "-2s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(1, (spell.cooldown || 8) - 2);
            }
        },
        {
            level: 5,
            title: "Doomsday Device",
            description: "+50% Damage & +20% Area of Effect",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.radius = (spell.radius || 4) * 1.2;
            }
        }
    ],
    FIRE_TRAIL: [
        {
            level: 2,
            title: "Scorched Earth",
            description: "+30% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.30;
            }
        },
        {
            level: 3,
            title: "Endless Path",
            description: "+2s Duration",
            apply: (spell) => {
                spell.duration = (spell.duration || 5) + 2;
            }
        },
        {
            level: 4,
            title: "Wide Blaze",
            description: "+50% Area of Effect",
            apply: (spell) => {
                spell.radius = (spell.radius || 1.5) * 1.5;
            }
        },
        {
            level: 5,
            title: "Hellfire Trail",
            description: "+50% Damage & +3s Duration",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.duration = (spell.duration || 5) + 3;
            }
        }
    ],
    FIRE_CONE: [
        {
            level: 2,
            title: "Searing Breath",
            description: "+30% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.30;
            }
        },
        {
            level: 3,
            title: "Far Reaching Flames",
            description: "+30% Distance",
            apply: (spell) => {
                spell.distance = (spell.distance || 8) * 1.3;
            }
        },
        {
            level: 4,
            title: "Rapid Fire",
            description: "-1s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(1, (spell.cooldown || 5) - 1);
            }
        },
        {
            level: 5,
            title: "Dragon King's Wrath",
            description: "+50% Damage & +30% Distance",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.distance = (spell.distance || 8) * 1.3;
            }
        }
    ],
    WIND_BLADE: [
        {
            level: 2,
            title: "Sharp Gust",
            description: "+25% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.25;
            }
        },
        {
            level: 3,
            title: "Twin Blades",
            description: "+1 Projectile",
            apply: (spell) => {
                spell.projectiles = (spell.projectiles || 1) + 1;
            }
        },
        {
            level: 4,
            title: "Swift Cast",
            description: "-0.5s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(0.5, (spell.cooldown || 2) - 0.5);
            }
        },
        {
            level: 5,
            title: "Storm Slash",
            description: "+50% Damage & +1 Projectile",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.projectiles = (spell.projectiles || 1) + 1;
            }
        }
    ],
    TORNADO: [
        {
            level: 2,
            title: "Violent Winds",
            description: "+30% Damage",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.30;
            }
        },
        {
            level: 3,
            title: "Widening Vortex",
            description: "+30% Size",
            apply: (spell) => {
                spell.scale = (spell.scale || 1) * 1.3;
            }
        },
        {
            level: 4,
            title: "Relentless Storm",
            description: "-2s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(2, (spell.cooldown || 8) - 2);
            }
        },
        {
            level: 5,
            title: "F5 Tornado",
            description: "+50% Damage & +30% Size",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                spell.scale = (spell.scale || 1) * 1.3;
            }
        }
    ],
    WIND_REPULSE: [
        {
            level: 2,
            title: "Gale Force",
            description: "+30% Knockback",
            apply: (spell) => {
                let effect = spell.effects.find(e => e.type === "KNOCKBACK");
                if (effect) effect.force *= 1.3;
            }
        },
        {
            level: 3,
            title: "Expanding Shockwave",
            description: "+30% Radius",
            apply: (spell) => {
                spell.radius = (spell.radius || 6) * 1.3;
            }
        },
        {
            level: 4,
            title: "Quick Burst",
            description: "-2s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(2, (spell.cooldown || 10) - 2);
            }
        },
        {
            level: 5,
            title: "Typhoon Blast",
            description: "+50% Damage & +30% Knockback",
            apply: (spell) => {
                spell.damageMult = (spell.damageMult || 1) + 0.50;
                let effect = spell.effects.find(e => e.type === "KNOCKBACK");
                if (effect) effect.force *= 1.3;
            }
        }
    ],
    WIND_DOMAIN: [
        {
            level: 2,
            title: "Lingering Winds",
            description: "+2s Duration",
            apply: (spell) => {
                spell.duration = (spell.duration || 6) + 2;
            }
        },
        {
            level: 3,
            title: "Vast Domain",
            description: "+30% Radius",
            apply: (spell) => {
                spell.radius = (spell.radius || 8) * 1.3;
            }
        },
        {
            level: 4,
            title: "Everlasting Breeze",
            description: "-2s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(2, (spell.cooldown || 12) - 2);
            }
        },
        {
            level: 5,
            title: "Eye of the Storm",
            description: "+4s Duration & +50% Radius",
            apply: (spell) => {
                spell.duration = (spell.duration || 6) + 4;
                spell.radius = (spell.radius || 8) * 1.5;
            }
        }
    ],
    TAILWIND: [
        {
            level: 2,
            title: "Enduring Haste",
            description: "+2s Duration",
            apply: (spell) => {
                spell.duration = (spell.duration || 5) + 2;
            }
        },
        {
            level: 3,
            title: "Frequent Gusts",
            description: "-3s Cooldown",
            apply: (spell) => {
                spell.cooldown = Math.max(2, (spell.cooldown || 15) - 3);
            }
        },
        {
            level: 4,
            title: "Persistent Speed",
            description: "+3s Duration",
            apply: (spell) => {
                spell.duration = (spell.duration || 5) + 3;
            }
        },
        {
            level: 5,
            title: "God of the Winds",
            description: "+4s Duration & -2s Cooldown",
            apply: (spell) => {
                spell.duration = (spell.duration || 5) + 4;
                spell.cooldown = Math.max(2, (spell.cooldown || 15) - 2);
            }
        }
    ]
};
