export const SpellDatabase = {
    FIREBALL: {
        id: "FIREBALL",
        name: "Boule de feu",
        element: "FIRE",
        icon: "🔥",
        desc: "Lance un puissant projectile explosif.",
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
        element: "ICE",
        icon: "❄️",
        desc: "Gèle les ennemis autour de vous.",
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
        element: "EARTH",
        icon: "s🪨",
        desc: "Brise la terre en cône devant vous.",
        castType: "CONE",
        distance: 15,
        angle: 45,
        cooldown: 1, // Secondes
        effects: [
            { type: "DAMAGE", amount: 50, element: "EARTH" },
            { type: "SLOW", duration: 3000, factor: 0.5 }
        ]
    },
    WIND_GUST: {
        id: "WIND_GUST",
        name: "Rafale",
        element: "AIR",
        icon: "🌪️",
        desc: "Repousse tous les ennemis.",
        castType: "CONE",
        distance: 20,
        angle: 90,
        cooldown: 1, // Secondes
        effects: [
            { type: "DAMAGE", amount: 20, element: "AIR" },
            { type: "KNOCKBACK", force: 10 }
        ]
    }
};
