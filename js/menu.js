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
    const btnHowToPlay = document.getElementById('btnHowToPlay');

    const settingsPanel = document.getElementById('settingsPanel');
    const howToPlayPanel = document.getElementById('howToPlayPanel');
    const confirmModal = document.getElementById('confirmModal');

    const hubVolumeSlider = document.getElementById('hubVolumeSlider');
    const hubVolumeValue = document.getElementById('hubVolumeValue');
    const hubBtnQwerty = document.getElementById('hubBtnQwerty');
    const hubBtnAzerty = document.getElementById('hubBtnAzerty');
    // 1. Vérification de la sauvegarde
    const hasSave = localStorage.getItem(STORAGE_SAVE_KEY);
    if (hasSave) {
        btnContinue.disabled = false;
        btnContinue.style.display = '';
    } else {
        btnContinue.style.display = 'none';
    }

    // 2. Chargement des paramètres (utilisant les mêmes clés que PauseManager)
    let volume = parseFloat(localStorage.getItem('ag_volume') ?? '0.8');
    let keyLayout = localStorage.getItem('ag_keyLayout') ?? 'QWERTY';

    if (hubVolumeSlider) hubVolumeSlider.value = volume;
    if (hubVolumeValue) hubVolumeValue.textContent = Math.round(volume * 100) + '%';
    window.gameVolume = volume;
    document.querySelectorAll('audio, video').forEach(el => { el.volume = volume; });

    const refreshKeyLayoutButtons = () => {
        if (!hubBtnQwerty || !hubBtnAzerty) return;
        const isQwerty = keyLayout === 'QWERTY';
        hubBtnQwerty.classList.toggle('active-layout', isQwerty);
        hubBtnAzerty.classList.toggle('active-layout', !isQwerty);
    };
    refreshKeyLayoutButtons();
    window.keyLayout = keyLayout;

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

    btnHowToPlay.addEventListener('click', () => {
        howToPlayPanel.classList.remove('hidden');
    });

    // 4. Événements des panneaux
    document.getElementById('btnCloseSettings').addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    document.getElementById('btnCloseHowToPlay').addEventListener('click', () => {
        howToPlayPanel.classList.add('hidden');
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
    if (hubVolumeSlider) {
        hubVolumeSlider.addEventListener('input', () => {
            volume = parseFloat(hubVolumeSlider.value);
            if (hubVolumeValue) hubVolumeValue.textContent = Math.round(volume * 100) + '%';
            localStorage.setItem('ag_volume', volume);
            window.gameVolume = volume;
            document.querySelectorAll('audio, video').forEach(el => { el.volume = volume; });
        });
    }

    if (hubBtnQwerty) {
        hubBtnQwerty.addEventListener('click', () => {
            keyLayout = 'QWERTY';
            localStorage.setItem('ag_keyLayout', keyLayout);
            window.keyLayout = keyLayout;
            refreshKeyLayoutButtons();
            console.log(`[Hub Menu] Clavier : QWERTY`);
        });
    }

    if (hubBtnAzerty) {
        hubBtnAzerty.addEventListener('click', () => {
            keyLayout = 'AZERTY';
            localStorage.setItem('ag_keyLayout', keyLayout);
            window.keyLayout = keyLayout;
            refreshKeyLayoutButtons();
            console.log(`[Hub Menu] Clavier : AZERTY`);
        });
    }
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
    
    // Si c'est un nouveau jeu, on efface tout
    if (!isContinue) {
        localStorage.removeItem(STORAGE_SAVE_KEY);
        localStorage.removeItem('arcane_glyphs_scores');
        
        // Reset loadout in memory if it exists
        if (window.loadoutManager) {
            window.loadoutManager.equippedElements.clear();
            window.loadoutManager.runeSpells = {};
        }
    } else {
        // Chargement des données si on clique sur continue
        const savedData = localStorage.getItem(STORAGE_SAVE_KEY);
        if (savedData && window.loadoutManager) {
            try {
                const parsed = JSON.parse(savedData);
                // The character will be loaded in HubScene/SceneManager from this cookie
                
                if (parsed.loadout) {
                    window.loadoutManager.equippedElements = new Set(parsed.loadout.elements || []);
                    window.loadoutManager.runeSpells = parsed.loadout.bindings || {};
                }
            } catch(e) {
                console.error("Erreur chargement save", e);
            }
        }
    }

    console.log(`[GAME START] Mode: ${isContinue ? 'CONTINUE' : 'NEW GAME'}`);
    
    // Déclenche l'événement global si besoin ou appelle le moteur
    if (window.onGameStart) {
        window.onGameStart(isContinue);
    }
}

// Fonction globale pour sauvegarder la progression (appelée quand on change de perso ou loadout)
window.saveGameData = function(characterName) {
    const loadout = window.loadoutManager ? window.loadoutManager.getLoadout() : { elements: [], bindings: {} };
    const dataToSave = {
        character: characterName,
        loadout: {
            elements: loadout.elements.map(e => e.id), // just save the IDs
            bindings: loadout.bindings
        }
    };
    localStorage.setItem(STORAGE_SAVE_KEY, JSON.stringify(dataToSave));
};
