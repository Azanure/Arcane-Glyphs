export const ElementDatabase = {
    // === ÉLÉMENTS PRIMORDIAUX ===
    FIRE: {
        id: "FIRE", name: "Feu", type: "PRIMORDIAL", color: "#ff4444"
    },
    ICE: {
        id: "ICE", name: "Glace", type: "PRIMORDIAL", color: "#44aaff"
    },
    EARTH: {
        id: "EARTH", name: "Terre", type: "PRIMORDIAL", color: "#66aa44"
    },
    AIR: {
        id: "AIR", name: "Air", type: "PRIMORDIAL", color: "#dddddd"
    },
    
    // === ÉLÉMENTS DE FUSION ===
    LAVA: {
        id: "LAVA", name: "Lave", type: "FUSION", color: "#ff8800", parents: ["FIRE", "EARTH"]
    },
    STORM: {
        id: "STORM", name: "Tempête", type: "FUSION", color: "#00eeee", parents: ["AIR", "ICE"]
    },
    SAND: {
        id: "SAND", name: "Sable", type: "FUSION", color: "#ddcc88", parents: ["EARTH", "AIR"]
    },
    FROSTFIRE: {
        id: "FROSTFIRE", name: "Givrefeu", type: "FUSION", color: "#ff00ff", parents: ["FIRE", "ICE"]
    },

    // === ÉLÉMENTS ÉSOTÉRIQUES ===
    VOID: {
        id: "VOID", name: "Vide", type: "ESOTERIC", color: "#440088"
    },
    LIGHT: {
        id: "LIGHT", name: "Lumière", type: "ESOTERIC", color: "#ffffaa"
    },
    TIME: {
        id: "TIME", name: "Temps", type: "ESOTERIC", color: "#00ffcc"
    },
    SPACE: {
        id: "SPACE", name: "Espace", type: "ESOTERIC", color: "#000000" // Avec ombre portée
    }
};

window.ElementDatabase = ElementDatabase;
