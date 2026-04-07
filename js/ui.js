/**
 * Gestion de l'Interface Utilisateur (Toasts, Notifications)
 */

const toastContainer = document.getElementById('toastContainer');

/**
 * Crée et affiche le message popup temporaire
 * @param {string} message 
 */
export function showToast(message) {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);
    
    // Destruction automatique après la fin de l'animation CSS (2s)
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 2000);
}

const trackingStatus = document.getElementById('trackingStatus');
const statusText = document.getElementById('statusText');

/**
 * Met à jour l'affichage du statut du tracking MediaPipe
 * @param {string} state - 'none', 'waiting', 'correct'
 */
export function updateTrackingStatus(state) {
    if (!trackingStatus || !statusText) return;

    switch (state) {
        case 'none':
            trackingStatus.className = "";
            statusText.innerText = "Main invisible (Préparez le symbole)";
            break;
        case 'waiting':
            trackingStatus.className = "waiting";
            statusText.innerText = "Pincez index/pouce pour dessiner";
            break;
        case 'correct':
            trackingStatus.className = "correct";
            statusText.innerText = "Symbole OK ! (Dessin)";
            break;
    }
}
