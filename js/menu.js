/**
 * Gestion du Menu Principal et du LocalStorage
 */

const STORAGE_SAVE_KEY = 'arcane_glyphs_save';
const STORAGE_SETTINGS_KEY = 'arcane_glyphs_settings';

/**
 * Initialise le menu principal
 */
export function initMenu() {
    const mainMenu = document.getElementById('mainMenu');
    const btnNewGame = document.getElementById('btnNewGame');
    const btnContinue = document.getElementById('btnContinue');
    const btnSettings = document.getElementById('btnSettings');
    const btnCredits = document.getElementById('btnCredits');
    const btnQuit = document.getElementById('btnQuit');

    const settingsPanel = document.getElementById('settingsPanel');
    const creditsPanel = document.getElementById('creditsPanel');
    const confirmModal = document.getElementById('confirmModal');

    const musicVolume = document.getElementById('musicVolume');
    const mouseSensitivity = document.getElementById('mouseSensitivity');

    // 1. Vérification de la sauvegarde
    const hasSave = localStorage.getItem(STORAGE_SAVE_KEY);
    if (hasSave) {
        btnContinue.disabled = false;
    }

    // 2. Chargement des paramètres
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_SETTINGS_KEY)) || { volume: 70, sensitivity: 5 };
    musicVolume.value = savedSettings.volume;
    mouseSensitivity.value = savedSettings.sensitivity;

    // 3. Événements des boutons principaux
    btnNewGame.addEventListener('click', () => {
        if (localStorage.getItem(STORAGE_SAVE_KEY)) {
            confirmModal.classList.remove('hidden');
        } else {
            startGame(false);
        }
    });

    btnContinue.addEventListener('click', () => {
        startGame(true);
    });

    btnSettings.addEventListener('click', () => {
        settingsPanel.classList.remove('hidden');
    });

    btnCredits.addEventListener('click', () => {
        creditsPanel.classList.remove('hidden');
    });

    btnQuit.addEventListener('click', () => {
        alert("Merci d'avoir joué !");
    });

    // 4. Événements des panneaux
    document.getElementById('btnCloseSettings').addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    document.getElementById('btnCloseCredits').addEventListener('click', () => {
        creditsPanel.classList.add('hidden');
    });

    // 5. Modale de confirmation New Game
    document.getElementById('btnConfirmNew').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_SAVE_KEY);
        confirmModal.classList.add('hidden');
        startGame(false);
    });

    document.getElementById('btnCancelNew').addEventListener('click', () => {
        confirmModal.classList.add('hidden');
    });

    // 6. Sauvegarde auto des paramètres
    const saveSettings = () => {
        const settings = {
            volume: musicVolume.value,
            sensitivity: mouseSensitivity.value
        };
        localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
        console.log("Paramètres sauvegardés :", settings);
    };

    musicVolume.addEventListener('input', saveSettings);
    mouseSensitivity.addEventListener('input', saveSettings);
}

/**
 * Lance le jeu
 * @param {boolean} isContinue 
 */
function startGame(isContinue) {
    const mainMenu = document.getElementById('mainMenu');
    if (mainMenu) {
        mainMenu.classList.add('hidden');
    }
    
    // Si c'est un nouveau jeu, on peut initialiser une sauvegarde par défaut
    if (!isContinue) {
        const defaultSave = { level: 1, health: 100, position: { x: 0, z: 0 } };
        localStorage.setItem(STORAGE_SAVE_KEY, JSON.stringify(defaultSave));
    }

    console.log(`[GAME START] Mode: ${isContinue ? 'CONTINUE' : 'NEW GAME'}`);
    
    // Déclenche l'événement global si besoin ou appelle le moteur
    if (window.onGameStart) {
        window.onGameStart(isContinue);
    }
}
