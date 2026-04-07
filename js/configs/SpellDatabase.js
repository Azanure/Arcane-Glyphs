export const SpellDatabase = {
    FIREBALL: {
        id: "FIREBALL",
        name: "Boule de feu",
        castType: "PROJECTILE_AOE",
        radius: 5,
        cooldown: 1, // Secondes
        effects: [
            { type: "DAMAGE", amount: 50, element: "FIRE" }
        ]
    },
    ICE_AURA: {
        id: "ICE_AURA",
        name: "Aura de Glace",
        castType: "AURA",
        radius: 10,
        cooldown: 1, // Secondes
        effects: [
            { type: "DAMAGE", amount: 50, element: "ICE" },
            { type: "FREEZE", duration: 3000 }
        ]
    },
    SEISMIC_WAVE: {
        id: "SEISMIC_WAVE",
        name: "Vague Sismique",
        castType: "CONE",
        distance: 15,
        angle: 45,
        cooldown: 1, // Secondes
        effects: [
            { type: "DAMAGE", amount: 50, element: "EARTH" },
            { type: "SLOW", duration: 3000, factor: 0.5 }
        ]
    }
};
