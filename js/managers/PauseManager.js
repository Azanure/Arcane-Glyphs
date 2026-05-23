/**
 * PauseManager.js
 * Gère le menu pause (Échap), la page Settings et le popup de confirmation de retour au Hub.
 *
 * Fonctionnalités :
 *  - Pause / Reprise via Échap
 *  - Menu pause : Reprendre / Settings / Retour au Hub
 *  - Page Settings : volume sonore + choix clavier AZERTY / QWERTY
 *  - Popup de confirmation avant retour
 */
export class PauseManager {
    constructor(onReturnToHub, isHub = false) {
        this._onReturnToHub = onReturnToHub;
        this._isHub = isHub;
        this._isPaused = false;

        // Charger les préférences sauvegardées (AZERTY par défaut)
        this._volume = parseFloat(localStorage.getItem('ag_volume') ?? '0.8');
        this._keyLayout = localStorage.getItem('ag_keyLayout') ?? 'AZERTY';

        this._buildUI();
        this._setupKeyListener();
        this._applySettings();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CONSTRUCTION UI
    // ──────────────────────────────────────────────────────────────────────────
    _buildUI() {
        // === MENU PAUSE ===
        this._pauseOverlay = document.getElementById('pauseMenuOverlay');
        this._btnResume = document.getElementById('pauseBtnResume');
        this._btnSettings = document.getElementById('pauseBtnSettings');
        this._btnReturn = document.getElementById('pauseBtnReturn');

        // Cacher le bouton "Quitter" si on est dans le Hub
        if (this._isHub && this._btnReturn) {
            this._btnReturn.classList.add('hidden');
        } else if (this._btnReturn) {
            this._btnReturn.classList.remove('hidden');
        }

        // === PAGE SETTINGS ===
        this._settingsOverlay = document.getElementById('settingsOverlay');
        this._volumeSlider = document.getElementById('settingsVolumeSlider');
        this._volumeValue = document.getElementById('settingsVolumeValue');
        this._btnQwerty = document.getElementById('settingsBtnQwerty');
        this._btnAzerty = document.getElementById('settingsBtnAzerty');
        this._btnSettingsBack = document.getElementById('settingsBtnBack');

        // === POPUP CONFIRMATION ===
        this._confirmOverlay = document.getElementById('confirmReturnOverlay');
        this._btnConfirmYes = document.getElementById('confirmBtnYes');
        this._btnConfirmNo = document.getElementById('confirmBtnNo');

        // ---- LISTENERS ----

        // Pause menu
        this._btnResume?.addEventListener('click', () => this.resume());
        this._btnSettings?.addEventListener('click', () => this._openSettings());
        this._btnReturn?.addEventListener('click', () => this._openConfirm());

        // Settings
        this._volumeSlider?.addEventListener('input', () => this._onVolumeChange());
        this._btnQwerty?.addEventListener('click', () => this._setKeyLayout('QWERTY'));
        this._btnAzerty?.addEventListener('click', () => this._setKeyLayout('AZERTY'));
        this._btnSettingsBack?.addEventListener('click', () => this._closeSettings());

        // Confirmation
        this._btnConfirmYes?.addEventListener('click', () => this._returnToHub());
        this._btnConfirmNo?.addEventListener('click', () => this._closeConfirm());
    }

    _setupKeyListener() {
        this._keyHandler = (e) => {
            if (e.code !== 'Escape') return;
            e.preventDefault();

            // Si le popup de confirmation est ouvert → fermer avec Échap
            if (!this._confirmOverlay?.classList.contains('hidden')) {
                this._closeConfirm();
                return;
            }
            // Si les settings sont ouverts → revenir au menu pause
            if (!this._settingsOverlay?.classList.contains('hidden')) {
                this._closeSettings();
                return;
            }
            // Sinon toggle pause
            if (this._isPaused) {
                this.resume();
            } else {
                this.pause();
            }
        };
        window.addEventListener('keydown', this._keyHandler);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PAUSE / RESUME
    // ──────────────────────────────────────────────────────────────────────────
    pause() {
        if (this._isPaused) return;
        this._isPaused = true;
        window.isGamePaused = true;
        this._pauseOverlay?.classList.remove('hidden');
    }

    resume() {
        if (!this._isPaused) return;
        this._isPaused = false;
        window.isGamePaused = false;
        this._pauseOverlay?.classList.add('hidden');
        this._closeSettings();
        this._closeConfirm();
    }

    get isPaused() { return this._isPaused; }

    // ──────────────────────────────────────────────────────────────────────────
    // SETTINGS
    // ──────────────────────────────────────────────────────────────────────────
    _openSettings() {
        // Sync UI avec les valeurs actuelles
        if (this._volumeSlider) this._volumeSlider.value = this._volume;
        if (this._volumeValue) this._volumeValue.textContent = Math.round(this._volume * 100) + '%';
        this._refreshKeyLayoutButtons();
        this._pauseOverlay?.classList.add('hidden');
        this._settingsOverlay?.classList.remove('hidden');
    }

    _closeSettings() {
        this._settingsOverlay?.classList.add('hidden');
        // Si on est encore en pause, ré-afficher le menu pause
        if (this._isPaused) {
            this._pauseOverlay?.classList.remove('hidden');
        }
    }

    _onVolumeChange() {
        this._volume = parseFloat(this._volumeSlider.value);
        if (this._volumeValue) this._volumeValue.textContent = Math.round(this._volume * 100) + '%';
        localStorage.setItem('ag_volume', this._volume);
        this._applyVolume();
    }

    _applyVolume() {
        // Appliquer à tous les AudioContext / éléments audio du DOM
        document.querySelectorAll('audio, video').forEach(el => { el.volume = this._volume; });
        // Exposer globalement pour d'autres systèmes audio
        window.gameVolume = this._volume;
    }

    _setKeyLayout(layout) {
        this._keyLayout = layout;
        localStorage.setItem('ag_keyLayout', layout);
        window.keyLayout = layout;
        this._refreshKeyLayoutButtons();
        console.log(`[PauseManager] Clavier : ${layout}`);
    }

    _refreshKeyLayoutButtons() {
        if (!this._btnQwerty || !this._btnAzerty) return;
        const isQwerty = this._keyLayout === 'QWERTY';
        this._btnQwerty.classList.toggle('active-layout', isQwerty);
        this._btnAzerty.classList.toggle('active-layout', !isQwerty);
    }

    _applySettings() {
        this._applyVolume();
        window.keyLayout = this._keyLayout;
        this._refreshKeyLayoutButtons();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CONFIRMATION RETOUR
    // ──────────────────────────────────────────────────────────────────────────
    _openConfirm() {
        this._pauseOverlay?.classList.add('hidden');
        this._confirmOverlay?.classList.remove('hidden');
    }

    _closeConfirm() {
        this._confirmOverlay?.classList.add('hidden');
        if (this._isPaused) {
            this._pauseOverlay?.classList.remove('hidden');
        }
    }

    _returnToHub() {
        this.resume(); // Dé-pause d'abord pour éviter l'état bloqué
        if (this._onReturnToHub) this._onReturnToHub();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    dispose() {
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        this._pauseOverlay?.classList.add('hidden');
        this._settingsOverlay?.classList.add('hidden');
        this._confirmOverlay?.classList.add('hidden');
    }
}
