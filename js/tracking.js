/**
 * Tracking MediaPipe Hands et Détection de Symboles
 */

import { showToast, updateTrackingStatus } from './ui.js';

let isDrawing = false;
let drawingPoints = [];
let framesWithoutPinch = 0; // Compteur pour éviter les micro-coupures de pince
let framesWithoutHand = 0;   // Compteur pour éviter les micro-coupures de main totale
const PINCH_DEBOUNCE_FRAMES = 5; 
const HAND_LOSS_DEBOUNCE_FRAMES = 15; // Tolérance de 15 frames (~0.5s)

// Variables pour l'animation de fondu après validation
let fadingPoints = [];
let fadeStartTime = 0;
const FADE_DURATION = 500; // ms

// Initialisation de la position lissée
let smoothedX = window.innerWidth / 2;
let smoothedY = window.innerHeight / 2;

window.isDebugMouseMode = false;

/**
 * Initialise le tracking des mains
 */
export function initTracking(videoElement, drawingCanvas, magicCursor) {
    const ctx = drawingCanvas.getContext('2d');

    // == MODE DEBUG SOURIS ==
    window.addEventListener('keydown', (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            window.isDebugMouseMode = !window.isDebugMouseMode;
            
            if (videoElement) {
                videoElement.style.opacity = window.isDebugMouseMode ? "0" : "1";
            }
            
            if (window.isDebugMouseMode) {
                if (window.isPausedByHandLoss) {
                    const overlay = document.getElementById("handLostOverlay");
                    if (overlay) overlay.classList.add("hidden");
                    window.isPausedByHandLoss = false;
                    
                    // On ne retire la pause globale que si aucun autre écran (Level Up) n'est actif
                    const levelUpScreen = document.getElementById("levelUpScreen");
                    if (!levelUpScreen || levelUpScreen.classList.contains("hidden")) {
                        window.isGamePaused = false;
                    }
                }
                showToast("Mode Souris Activé (TAB pour annuler)");
            } else {
                showToast("Mode Tracking Caméra Activé");
            }
        }
    });

    document.addEventListener('pointermove', (e) => {
        if (!window.isDebugMouseMode) return;
        smoothedX = e.clientX;
        smoothedY = e.clientY;
        window.smoothedCursorX = smoothedX;
        window.smoothedCursorY = smoothedY;
        
        if (magicCursor) {
            magicCursor.style.left = `${smoothedX}px`;
            magicCursor.style.top = `${smoothedY}px`;
        }

        // Sécurité : si on n'a plus le bouton pressé mais qu'on dessine encore (ex: sortie de fenêtre)
        if (isDrawing && e.buttons !== 1) {
            finishDrawing();
            updateTrackingStatus('waiting');
            if (magicCursor) magicCursor.classList.remove('drawing');
            return;
        }

        if (isDrawing) {
            // Ajout direct sans seuil pour garantir la visibilité immédiate
            drawingPoints.push({ x: smoothedX, y: smoothedY });
        }
    }, { capture: true });

    document.addEventListener('pointerdown', (e) => {
        if (!window.isDebugMouseMode) return;
        if (e.button !== 0) return; // clic gauche uniquement
        
        if (magicCursor) {
            updateTrackingStatus('correct');
            magicCursor.classList.remove('lost');

            if (!isDrawing && !window.preventNewDrawing) {
                console.log("[DEBUG] pointerdown -> start drawing");
                isDrawing = true;
                drawingPoints = [{ x: e.clientX, y: e.clientY }]; // Ajout du premier point immédiatement
                magicCursor.classList.add('drawing');
            }
        }
    }, { capture: true });

    document.addEventListener('pointerup', (e) => {
        if (!window.isDebugMouseMode) return;
        if (e.button !== 0) return;
        
        if (isDrawing) {
            finishDrawing();
        }
        window.preventNewDrawing = false; // Permet de redessiner immédiatement
        updateTrackingStatus('waiting');
        if (magicCursor) {
            magicCursor.classList.remove('drawing');
        }
    }, { capture: true });
    // =======================

    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults((results) => {
        if (window.isDebugMouseMode) return;

        // Si une main est trouvée
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            framesWithoutHand = 0;
            
            // Reprise automatique si on était en pause "Main Perdue"
            if (window.isPausedByHandLoss) {
                const overlay = document.getElementById("handLostOverlay");
                if (overlay) overlay.classList.add("hidden");
                window.isPausedByHandLoss = false;
                
                // On ne retire la pause globale que si aucun autre écran (Level Up) n'est actif
                const levelUpScreen = document.getElementById("levelUpScreen");
                if (!levelUpScreen || levelUpScreen.classList.contains("hidden")) {
                    window.isGamePaused = false;
                }
            }

            const landmarks = results.multiHandLandmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            // 1) Pincement
            const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
            const currentlyPinching = distance < 0.05;

            // 2) Position
            const targetX = (1 - ((thumbTip.x + indexTip.x) / 2)) * window.innerWidth;
            const targetY = ((thumbTip.y + indexTip.y) / 2) * window.innerHeight;

            // 3) LISSAGE (LERP)
            smoothedX = smoothedX * 0.5 + targetX * 0.5;
            smoothedY = smoothedY * 0.5 + targetY * 0.5;
            window.smoothedCursorX = smoothedX;
            window.smoothedCursorY = smoothedY;

            magicCursor.style.left = `${smoothedX}px`;
            magicCursor.style.top = `${smoothedY}px`;

            // 4) GESTE MAIN OUVERTE
            window.isOpenPalm = [8, 12, 16, 20].every(tipIdx => landmarks[tipIdx].y < landmarks[tipIdx - 2].y);
            const indicator = document.getElementById("gestureIndicator");
            if (indicator) {
                if (window.isOpenPalm) indicator.classList.add("active");
                else indicator.classList.remove("active");
            }

            // 5) DESSIN
            if (currentlyPinching) {
                framesWithoutPinch = 0;
                updateTrackingStatus('correct');
                magicCursor.classList.remove('lost');

                if (!isDrawing && !window.preventNewDrawing) {
                    isDrawing = true;
                    drawingPoints = [];
                    magicCursor.classList.add('drawing');
                } else if (isDrawing) {
                    drawingPoints.push({ x: smoothedX, y: smoothedY });
                }
            } else {
                updateTrackingStatus('waiting');
                magicCursor.classList.remove('drawing'); 
                magicCursor.classList.remove('lost');
                window.preventNewDrawing = false; 

                if (isDrawing) {
                    framesWithoutPinch++;
                    if (framesWithoutPinch >= PINCH_DEBOUNCE_FRAMES) finishDrawing();
                }
            }
        } else {
            updateTrackingStatus('none');
            magicCursor.classList.add('lost');
            if (isDrawing) {
                framesWithoutHand++;
                // On ne ferme le dessin que si la main est perdue depuis un certain temps
                if (framesWithoutHand >= HAND_LOSS_DEBOUNCE_FRAMES) {
                    finishDrawing();
                }
            }
            
            // LOGIQUE DE PAUSE (Si aucune main du tout)
            if (framesWithoutHand >= HAND_LOSS_DEBOUNCE_FRAMES && !window.isPausedByHandLoss) {
                window.isPausedByHandLoss = true;
                window.isGamePaused = true;
                const overlay = document.getElementById("handLostOverlay");
                if (overlay) overlay.classList.remove("hidden");
                console.log("[TRACKING] Pause : Main perdue.");
            }
        }

    });

    // --- BOUCLE DE DESSIN INDÉPENDANTE ---
    function renderLoop() {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        
        // 1. Animation de fondu
        if (fadeStartTime > 0) {
            let elapsed = performance.now() - fadeStartTime;
            if (elapsed < FADE_DURATION) {
                let progress = elapsed / FADE_DURATION;
                ctx.save();
                ctx.globalAlpha = 1.0 - progress;
                ctx.strokeStyle = '#FFFFFF';
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#FFD700'; 
                ctx.lineWidth = 10;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                if (fadingPoints.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(fadingPoints[0].x, fadingPoints[0].y);
                    for (let i = 1; i < fadingPoints.length; i++) ctx.lineTo(fadingPoints[i].x, fadingPoints[i].y);
                    ctx.stroke();
                }
                ctx.restore();
            } else {
                fadeStartTime = 0;
                fadingPoints = [];
            }
        }

        // Dessiner le tracé actif
        if (isDrawing && drawingPoints.length > 1) {
            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) {
                ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        requestAnimationFrame(renderLoop);
    }
    // Lancer la boucle de rendu
    renderLoop();

    function finishDrawing() {
        console.log("[DEBUG] finishDrawing called, points:", drawingPoints.length);
        if (!isDrawing) return;
        isDrawing = false;
        framesWithoutPinch = 0;
        framesWithoutHand = 0;
        magicCursor.classList.remove('drawing');
        
        if (drawingPoints.length > 5) {
            console.log("[DEBUG] Starting detectShape...");
            const detectedValue = detectShape(drawingPoints);
            console.log("[DEBUG] Shape detected:", detectedValue);
            if (detectedValue) {
                fadingPoints = [...drawingPoints];
                fadeStartTime = performance.now();
            }
        }
        drawingPoints = [];
        console.log("[DEBUG] finishDrawing finished.");
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => { await hands.send({image: videoElement}); },
        width: 640, height: 480
    });
    camera.start();
}

let _shapeDetectionActive = false;
export function startShapeDetection() { _shapeDetectionActive = true; }
export function stopShapeDetection() { _shapeDetectionActive = false; }

/**
 * Ré-échantillonne un tracé pour obtenir exactement n points équidistants
 * Version sécurisée sans modification de tableau (immuable)
 */
function resample(points, n) {
    console.log("[DEBUG] resample started with", points.length, "points");
    if (points.length === 0) return [];
    if (points.length === 1) return Array(n).fill({ ...points[0] });

    let totalLen = pathLength(points);
    if (totalLen < 0.001) return Array(n).fill({ ...points[0] });

    const interval = totalLen / (n - 1);
    let cumulativeDist = 0;
    const newPoints = [points[0]];
    
    // On parcourt les segments originaux
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        let d = distance(p1, p2);

        if (cumulativeDist + d >= interval) {
            // On peut extraire un ou plusieurs points de ce segment
            let currentDistOnSegment = interval - cumulativeDist;
            while (currentDistOnSegment <= d && newPoints.length < n) {
                const ratio = d === 0 ? 0 : currentDistOnSegment / d;
                newPoints.push({
                    x: p1.x + ratio * (p2.x - p1.x),
                    y: p1.y + ratio * (p2.y - p1.y)
                });
                d -= currentDistOnSegment; // Distance restante sur le segment original
                // On repart du point qu'on vient de créer pour le prochain intervalle
                // (En réalité on ajuste juste pour simuler qu'on a "consommé" un intervalle)
                currentDistOnSegment = interval; 
                cumulativeDist = 0;
            }
            // Ce qu'il reste du segment après avoir extrait les points
            cumulativeDist = d; 
        } else {
            cumulativeDist += d;
        }
    }

    // Sécurité : compléter si nécessaire (flottants capricieux)
    while (newPoints.length < n) {
        newPoints.push({ ...points[points.length - 1] });
    }

    return newPoints.slice(0, n);
}

function pathLength(points) {
    let d = 0;
    for (let i = 1; i < points.length; i++) d += distance(points[i - 1], points[i]);
    return d;
}

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Reconnaissance de formes sur points ré-échantillonnés
 */
function detectShape(rawPoints) {
    if (!_shapeDetectionActive || rawPoints.length < 5) return null;

    // Sécurité supplémentaire : si le tracé est minuscule, ignorer
    const totalLen = pathLength(rawPoints);
    if (totalLen < 20) return null; 

    // 1. Ré-échantillonnage vers 32 points pour une analyse stable
    const points = resample([...rawPoints], 32);

    // 2. Calcul du centre et de la Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    points.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        sumX += p.x; sumY += p.y;
    });
    const centerX = sumX / points.length;
    const centerY = sumY / points.length;
    const width = maxX - minX;
    const height = maxY - minY;
    const bbDiag = Math.sqrt(width * width + height * height);

    // 3. Calcul de la fermeture (Début vs Fin)
    const closure = distance(points[0], points[points.length - 1]) / bbDiag;

    // 4. Calcul de la Circularité (Écart type du rayon)
    const radii = points.map(p => distance(p, { x: centerX, y: centerY }));
    const avgRadius = radii.reduce((a, b) => a + b) / radii.length;
    const variance = radii.reduce((a, b) => a + Math.pow(b - avgRadius, 2), 0) / radii.length;
    const circularity = Math.sqrt(variance) / avgRadius;

    // 5. Calcul de l'Aire (Shoelace)
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        let j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    const areaRatio = (Math.abs(area) * 0.5) / (width * height || 0.0001);

    let detectedName = "";
    const totalDist = pathLength(points);

    // LOGIQUE DE DÉCISION
    // A. LIGNE : Pas fermée ET tracé direct
    if (closure > 0.6 || (totalDist < bbDiag * 1.3)) {
        detectedName = "LIGNE";
    }
    // B. CERCLE : Fermé ET circularité très basse (très proche du rayon moyen)
    else if (closure < 0.4 && circularity < 0.22) { // Tolerance assouplie grâce au resampling
        detectedName = "CERCLE";
    }
    // C. TRIANGLE : Fermé MAIS circularité élevée (les coins sont plus loin du centre)
    else if (closure < 0.5) {
        detectedName = "TRIANGLE";
    }
    
    if (detectedName) {
        showToast(`Tracé : ${detectedName}`);
        if (window.onShapeDetected) window.onShapeDetected(detectedName);
        return detectedName;
    }
    return null;
}
