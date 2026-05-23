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
            
            // (Pause main perdue désactivée)

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
            if (currentlyPinching && !window.isInHub) {
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
            
            // (Pause main perdue désactivée)
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


// ═══════════════════════════════════════════════════════════════
//  $1 UNISTROKE RECOGNIZER
//  Adaptation du célèbre algorithme de Jacob O. Wobbrock et al.
//  https://depts.washington.edu/acelab/proj/dollar/index.html
// ═══════════════════════════════════════════════════════════════

const NUM_POINTS = 64;
const SQUARE_SIZE = 250.0;
const DIAGONAL = Math.sqrt(SQUARE_SIZE * SQUARE_SIZE + SQUARE_SIZE * SQUARE_SIZE);
const HALF_DIAGONAL = 0.5 * DIAGONAL;
const ANGLE_RANGE = Math.PI / 4;  // ±45°
const ANGLE_PRECISION = Math.PI / 90; // 2°
const PHI = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden Ratio

function dollar_resample(points, n) {
    let I = pathLength(points) / (n - 1);
    let D = 0;
    let newpoints = [{ x: points[0].x, y: points[0].y }];
    for (let i = 1; i < points.length; i++) {
        let d = distance(points[i - 1], points[i]);
        if (D + d >= I) {
            let qx = points[i - 1].x + ((I - D) / d) * (points[i].x - points[i - 1].x);
            let qy = points[i - 1].y + ((I - D) / d) * (points[i].y - points[i - 1].y);
            let q = { x: qx, y: qy };
            newpoints.push(q);
            points.splice(i, 0, q);
            D = 0;
        } else {
            D += d;
        }
    }
    while (newpoints.length < n) newpoints.push({ ...points[points.length - 1] });
    return newpoints.slice(0, n);
}

function dollar_indicativeAngle(points) {
    let c = centroid(points);
    return Math.atan2(c.y - points[0].y, c.x - points[0].x);
}

function dollar_rotateBy(points, radians) {
    let c = centroid(points);
    let cos = Math.cos(radians);
    let sin = Math.sin(radians);
    return points.map(p => ({
        x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
        y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y
    }));
}

function dollar_scaleTo(points, size) {
    let B = boundingBox(points);
    return points.map(p => ({
        x: p.x * (size / B.width),
        y: p.y * (size / B.height)
    }));
}

function dollar_translateTo(points, pt) {
    let c = centroid(points);
    return points.map(p => ({
        x: p.x + pt.x - c.x,
        y: p.y + pt.y - c.y
    }));
}

function centroid(points) {
    let x = 0, y = 0;
    points.forEach(p => { x += p.x; y += p.y; });
    return { x: x / points.length, y: y / points.length };
}

function boundingBox(points) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    return { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 };
}

function dollar_pathDistance(pts1, pts2) {
    let d = 0;
    for (let i = 0; i < pts1.length; i++) d += distance(pts1[i], pts2[i]);
    return d / pts1.length;
}

function dollar_distanceAtBestAngle(points, T, a, b, threshold) {
    let x1 = PHI * a + (1.0 - PHI) * b;
    let f1 = dollar_pathDistance(dollar_rotateBy(points, x1), T.points);
    let x2 = (1.0 - PHI) * a + PHI * b;
    let f2 = dollar_pathDistance(dollar_rotateBy(points, x2), T.points);
    while (Math.abs(b - a) > threshold) {
        if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1.0 - PHI) * b; f1 = dollar_pathDistance(dollar_rotateBy(points, x1), T.points); }
        else { a = x1; x1 = x2; f1 = f2; x2 = (1.0 - PHI) * a + PHI * b; f2 = dollar_pathDistance(dollar_rotateBy(points, x2), T.points); }
    }
    return Math.min(f1, f2);
}

function dollar_normalize(rawPoints) {
    let pts = dollar_resample([...rawPoints], NUM_POINTS);
    let radians = dollar_indicativeAngle(pts);
    pts = dollar_rotateBy(pts, -radians);
    pts = dollar_scaleTo(pts, SQUARE_SIZE);
    pts = dollar_translateTo(pts, { x: 0, y: 0 });
    return pts;
}

// Génère des points pour un template à partir d'une fonction paramétrique
function makeTemplate(name, fn, steps) {
    let pts = [];
    for (let i = 0; i <= steps; i++) {
        let t = i / steps;
        pts.push(fn(t));
    }
    // Normalize to SQUARE_SIZE coordinate space directly
    let normalized = dollar_normalize(pts);
    return { name, points: normalized };
}

// ── Templates ──────────────────────────────────────────────────
// Tous définis dans un espace arbitraire, ils seront normalisés
// par dollar_normalize() lors de la reconnaissance.

function buildTemplates() {
    const T = [];
    const W = 200, H = 200, CX = 100, CY = 100;

    // CERCLE : 4 templates (CW, CCW, départ différents, ellipse)
    // CW depuis le point droit (0°)
    T.push(makeTemplate("CERCLE", t => ({
        x: CX + Math.cos(t * 2 * Math.PI) * 90,
        y: CY + Math.sin(t * 2 * Math.PI) * 90
    }), 64));
    // CCW depuis le point droit
    T.push(makeTemplate("CERCLE", t => ({
        x: CX + Math.cos(-t * 2 * Math.PI) * 90,
        y: CY + Math.sin(-t * 2 * Math.PI) * 90
    }), 64));
    // CW depuis le haut (90°)
    T.push(makeTemplate("CERCLE", t => ({
        x: CX + Math.cos(Math.PI/2 + t * 2 * Math.PI) * 90,
        y: CY + Math.sin(Math.PI/2 + t * 2 * Math.PI) * 90
    }), 64));
    // Ellipse aplatie (plus commune à la main)
    T.push(makeTemplate("CERCLE", t => ({
        x: CX + Math.cos(t * 2 * Math.PI) * W/2 * 0.9,
        y: CY + Math.sin(t * 2 * Math.PI) * H/2 * 0.7
    }), 64));

    // TRIANGLE : 6 templates couvrant toutes les façons naturelles de dessiner un triangle
    // Style 1 : pointe en haut, sens horaire (haut → bas-droite → bas-gauche → fermeture)
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX, y:CY-H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 2 : pointe en haut, sens anti-horaire (haut → bas-gauche → bas-droite → fermeture)
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX, y:CY-H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 3 : démarre en bas-gauche (très courant) : bas-gauche → haut → bas-droite → fermeture
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX-W/2, y:CY+H/2}, {x:CX, y:CY-H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX-W/2, y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 4 : démarre en bas-droite : bas-droite → haut → bas-gauche → fermeture
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX+W/2, y:CY+H/2}, {x:CX, y:CY-H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX+W/2, y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 5 : triangle rectangle (angle droit en bas-gauche)
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX-W/2, y:CY-H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX-W/2, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 6 : triangle isocèle aplati (plus large que haut)
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX, y:CY-H/3}, {x:CX+W/2, y:CY+H/3}, {x:CX-W/2, y:CY+H/3}, {x:CX, y:CY-H/3}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 7 : pointe vers le bas (triangle inversé), sens horaire
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX-W/2, y:CY-H/2}, {x:CX+W/2, y:CY-H/2}, {x:CX, y:CY+H/2}, {x:CX-W/2, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 8 : triangle pointe à droite (orienté comme un "play")
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX-W/2, y:CY-H/2}, {x:CX+W/2, y:CY}, {x:CX-W/2, y:CY+H/2}, {x:CX-W/2, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 9 : triangle pointe à gauche
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX+W/2, y:CY-H/2}, {x:CX-W/2, y:CY}, {x:CX+W/2, y:CY+H/2}, {x:CX+W/2, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 10 : triangle scalène 45° (penché vers la droite)
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX-W/4, y:CY-H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX-W/4, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 11 : triangle scalène penché vers la gauche
    T.push(makeTemplate("TRIANGLE", t => {
        const C = [{x:CX+W/4, y:CY-H/2}, {x:CX+W/2, y:CY+H/2}, {x:CX-W/2, y:CY+H/2}, {x:CX+W/4, y:CY-H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));
    // Style 12 : triangle équilatéral (proportions idéales)
    T.push(makeTemplate("TRIANGLE", t => {
        const h = H * Math.sqrt(3) / 4; // Hauteur exacte d'un équilatéral de côté W/2
        const C = [{x:CX, y:CY-h}, {x:CX+W/2*0.75, y:CY+h}, {x:CX-W/2*0.75, y:CY+h}, {x:CX, y:CY-h}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: C[s].x + u*(C[s+1].x-C[s].x), y: C[s].y + u*(C[s+1].y-C[s].y) };
    }, 64));

    // CARRE / RECTANGLE : 8 templates, tous les coins de départ x 2 directions
    // Note : dollar_scaleTo normalise X et Y séparément, donc un rectangle dessiné à la main
    // sera automatiquement étiré en carré lors de la comparaison - pas besoin de templates spécifiques.
    function makeSquare(startIdx, clockwise) {
        // 4 coins + fermeture, dans l'ordre demandé
        const TL = {x:CX-W/2, y:CY-H/2};
        const TR = {x:CX+W/2, y:CY-H/2};
        const BR = {x:CX+W/2, y:CY+H/2};
        const BL = {x:CX-W/2, y:CY+H/2};
        const base = [TL, TR, BR, BL];
        if (!clockwise) base.reverse();
        // Rotation du point de démarrage
        const rotated = [...base.slice(startIdx), ...base.slice(0, startIdx)];
        rotated.push(rotated[0]); // Fermeture
        return makeTemplate("CARRE", t => {
            const seg = t * 4; const s = Math.min(Math.floor(seg), 3); const u = seg - s;
            return { x: rotated[s].x + u*(rotated[s+1].x-rotated[s].x), y: rotated[s].y + u*(rotated[s+1].y-rotated[s].y) };
        }, 80);
    }
    // Sens horaire depuis chaque coin
    T.push(makeSquare(0, true));  // Haut-gauche CW
    T.push(makeSquare(1, true));  // Haut-droite CW
    T.push(makeSquare(2, true));  // Bas-droite CW
    T.push(makeSquare(3, true));  // Bas-gauche CW
    // Sens anti-horaire depuis chaque coin
    T.push(makeSquare(0, false)); // Haut-gauche CCW
    T.push(makeSquare(1, false)); // Haut-droite CCW
    T.push(makeSquare(2, false)); // Bas-droite CCW
    T.push(makeSquare(3, false)); // Bas-gauche CCW

    // LIGNE : trait horizontal gauche → droite
    T.push(makeTemplate("LIGNE", t => ({ x: CX - W/2 + t * W, y: CY }), 30));
    // 2ème LIGNE diagonale
    T.push(makeTemplate("LIGNE", t => ({ x: CX - W/2 + t * W, y: CY - H/2 + t * H }), 30));
    // 3ème LIGNE verticale
    T.push(makeTemplate("LIGNE", t => ({ x: CX, y: CY - H/2 + t * H }), 30));

    // V : 5 templates, toujours pointe en bas, ouverture en haut
    // Style 1 : V symétrique classique
    T.push(makeTemplate("V", t => {
        if (t < 0.5) { const u = t * 2; return { x: CX - W/2 + u * W/2, y: CY - H/2 + u * H }; }
        const u = (t-0.5)*2; return { x: CX + u * W/2, y: CY + H/2 - u * H };
    }, 48));
    // Style 2 : V plus étroit
    T.push(makeTemplate("V", t => {
        if (t < 0.5) { const u = t * 2; return { x: CX - W/3 + u * W/3, y: CY - H/2 + u * H }; }
        const u = (t-0.5)*2; return { x: CX + u * W/3, y: CY + H/2 - u * H };
    }, 48));
    // Style 3 : V plus large (ouverture importante)
    T.push(makeTemplate("V", t => {
        if (t < 0.5) { const u = t * 2; return { x: CX - W/2 + u * W/2, y: CY - H/3 + u * H * 0.8 }; }
        const u = (t-0.5)*2; return { x: CX + u * W/2, y: CY + H/2 - u * H * 0.8 };
    }, 48));
    // Style 4 : V asymétrique (bras gauche plus long)
    T.push(makeTemplate("V", t => {
        if (t < 0.55) { const u = t / 0.55; return { x: CX - W/2 + u * W/2, y: CY - H/2 + u * H }; }
        const u = (t-0.55)/0.45; return { x: CX + u * W/2, y: CY + H/2 - u * H };
    }, 48));
    // Style 5 : V asymétrique (bras droit plus long)
    T.push(makeTemplate("V", t => {
        if (t < 0.45) { const u = t / 0.45; return { x: CX - W/2 + u * W/2, y: CY - H/2 + u * H }; }
        const u = (t-0.45)/0.55; return { x: CX + u * W/2, y: CY + H/2 - u * H };
    }, 48));

    // U : 6 templates couvrant les différentes façons de dessiner un U
    // Style 1 : demi-cercle parfait
    T.push(makeTemplate("U", t => ({
        x: CX + Math.cos(Math.PI + t * Math.PI) * W/2,
        y: CY + Math.abs(Math.sin(Math.PI + t * Math.PI)) * H/2
    }), 56));
    // Style 2 : U anguleux (côtés droits, fond plat)
    T.push(makeTemplate("U", t => {
        if (t < 0.3) return { x: CX - W/2, y: CY - H/2 + (t/0.3) * H };
        if (t < 0.7) { const u=(t-0.3)/0.4; return { x: CX - W/2 + Math.sin(u*Math.PI)*W, y: CY + H/2 - Math.sin(u*Math.PI)*H*0.3 }; }
        const u=(t-0.7)/0.3; return { x: CX + W/2, y: CY + H/2 - u * H };
    }, 56));
    // Style 3 : U large et peu profond
    T.push(makeTemplate("U", t => ({
        x: CX + Math.cos(Math.PI + t * Math.PI) * W/2,
        y: CY + Math.abs(Math.sin(Math.PI + t * Math.PI)) * H/3
    }), 56));
    // Style 4 : U étroit et profond
    T.push(makeTemplate("U", t => ({
        x: CX + Math.cos(Math.PI + t * Math.PI) * W/3,
        y: CY + Math.abs(Math.sin(Math.PI + t * Math.PI)) * H/2
    }), 56));
    // Style 5 : U asymétrique bras gauche plus long
    T.push(makeTemplate("U", t => {
        if (t < 0.35) return { x: CX - W/2, y: CY - H/2 + (t/0.35) * H };
        if (t < 0.65) { const u=(t-0.35)/0.3; return { x: CX - W/2 + Math.sin(u*Math.PI)*W, y: CY + H/2 - Math.sin(u*Math.PI)*H*0.25 }; }
        const u=(t-0.65)/0.35; return { x: CX + W/2, y: CY + H/2 - u * H * 0.7 };
    }, 56));
    // Style 6 : U asymétrique bras droit plus long
    T.push(makeTemplate("U", t => {
        if (t < 0.3) return { x: CX - W/2, y: CY - H/2 + (t/0.3) * H * 0.7 };
        if (t < 0.65) { const u=(t-0.3)/0.35; return { x: CX - W/2 + Math.sin(u*Math.PI)*W, y: CY + H/2 - Math.sin(u*Math.PI)*H*0.25 }; }
        const u=(t-0.65)/0.35; return { x: CX + W/2, y: CY + H/2 - u * H };
    }, 56));

    // L : 5 templates couvrant les variations de dessin du L
    // Style 1 : L parfait (angle 90° net)
    T.push(makeTemplate("L", t => {
        if (t < 0.6) return { x: CX - W/4, y: CY - H/2 + (t/0.6) * H };
        const u = (t-0.6)/0.4; return { x: CX - W/4 + u * (W*0.75), y: CY + H/2 };
    }, 64));
    // Style 2 : L avec coin ARRONDI (quart de cercle de rayon H/6 au coude)
    T.push(makeTemplate("L", t => {
        const R = H / 6;
        const vertLen = H - R;   // longueur partie verticale
        const horizLen = W * 0.65; // longueur partie horizontale
        const total = vertLen + Math.PI/2 * R + horizLen;
        const tv = vertLen / total;
        const ta = (vertLen + Math.PI/2 * R) / total;
        if (t < tv) {
            // Segment vertical
            const u = t / tv;
            return { x: CX - W/4, y: CY - H/2 + u * vertLen };
        }
        if (t < ta) {
            // Arc de raccordement (quart de cercle)
            const u = (t - tv) / (ta - tv);
            const a = Math.PI + u * Math.PI/2; // de 180° à 270°
            return { x: CX - W/4 + R + Math.cos(a) * R, y: CY + H/2 - R + Math.sin(a) * R };
        }
        // Segment horizontal
        const u = (t - ta) / (1 - ta);
        return { x: CX - W/4 + R + u * horizLen, y: CY + H/2 };
    }, 64));
    // Style 3 : L très arrondi (grand quart-cercle)
    T.push(makeTemplate("L", t => {
        const R = H / 4;
        const vertLen = H - R;
        const horizLen = W * 0.65;
        const total = vertLen + Math.PI/2 * R + horizLen;
        const tv = vertLen / total;
        const ta = (vertLen + Math.PI/2 * R) / total;
        if (t < tv) {
            const u = t / tv;
            return { x: CX - W/4, y: CY - H/2 + u * vertLen };
        }
        if (t < ta) {
            const u = (t - tv) / (ta - tv);
            const a = Math.PI + u * Math.PI/2;
            return { x: CX - W/4 + R + Math.cos(a) * R, y: CY + H/2 - R + Math.sin(a) * R };
        }
        const u = (t - ta) / (1 - ta);
        return { x: CX - W/4 + R + u * horizLen, y: CY + H/2 };
    }, 64));
    // Style 4 : L plus large (segment horizontal plus long)
    T.push(makeTemplate("L", t => {
        if (t < 0.55) return { x: CX - W/2, y: CY - H/2 + (t/0.55) * H };
        const u = (t-0.55)/0.45; return { x: CX - W/2 + u * W, y: CY + H/2 };
    }, 64));
    // Style 5 : L plus court (segment horizontal court)
    T.push(makeTemplate("L", t => {
        if (t < 0.7) return { x: CX - W/4, y: CY - H/2 + (t/0.7) * H };
        const u = (t-0.7)/0.3; return { x: CX - W/4 + u * (W*0.5), y: CY + H/2 };
    }, 64));
    // Style 6 : L diagonal — trait en diagonale depuis haut-droite vers bas-gauche, puis horizontal
    // (comme dans l'image : la barre verticale est en diagonale, pas parfaitement verticale)
    T.push(makeTemplate("L", t => {
        if (t < 0.6) {
            const u = t / 0.6;
            return { x: CX + W/3 - u * W * 0.7, y: CY - H/2 + u * H }; // haut-droit vers bas-gauche
        }
        const u = (t-0.6)/0.4;
        return { x: CX - W/3 + u * (W * 0.8), y: CY + H/2 }; // bas gauche vers droite
    }, 64));
    // Style 7 : L diagonal arrondi au coin
    T.push(makeTemplate("L", t => {
        const R = H / 5;
        const diagLen = Math.sqrt((W*0.6)*(W*0.6) + H*H);
        const horizLen = W * 0.7;
        const total = diagLen + R * Math.PI/2 + horizLen;
        const td = diagLen / total;
        const ta = (diagLen + R * Math.PI/2) / total;
        if (t < td) {
            const u = t / td;
            return { x: CX + W/3 - u * (W * 0.6), y: CY - H/2 + u * H };
        }
        if (t < ta) {
            const u = (t - td) / (ta - td);
            const a = Math.PI * 1.25 + u * Math.PI/2;
            return { x: CX - W/4 + R + Math.cos(a) * R * 1.2, y: CY + H/2 - R + Math.sin(a) * R };
        }
        const u = (t - ta) / (1 - ta);
        return { x: CX - W/4 + R + u * horizLen, y: CY + H/2 };
    }, 64));
    // Style 8 : L très diagonal (angle très fermé, presque 45°)
    T.push(makeTemplate("L", t => {
        if (t < 0.65) {
            const u = t / 0.65;
            return { x: CX + W/2 - u * W, y: CY - H/2 + u * H }; // diagonale complete gauche
        }
        const u = (t-0.65)/0.35;
        return { x: CX - W/2 + u * W, y: CY + H/2 };
    }, 64));

    // Z : 5 templates couvrant les variations de dessin du Z
    // Style 1 : classique haut-gauche → haut-droite → bas-gauche → bas-droite
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/2,y:CY-H/2},{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY+H/2},{x:CX+W/2,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 2 : Z inversé (haut-droite → haut-gauche → bas-droite → bas-gauche)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY-H/2},{x:CX+W/2,y:CY+H/2},{x:CX-W/2,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 3 : Z plus aplati (segments horizontaux plus longs, diagonale plus courte)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/2,y:CY-H/3},{x:CX+W/2,y:CY-H/3},{x:CX-W/2,y:CY+H/3},{x:CX+W/2,y:CY+H/3}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 4 : Z étiré verticalement
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/3,y:CY-H/2},{x:CX+W/3,y:CY-H/2},{x:CX-W/3,y:CY+H/2},{x:CX+W/3,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 5 : Z avec segments égaux (45°)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/2,y:CY-H/2},{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY+H/2},{x:CX+W/2,y:CY+H/2}];
        // Variante avec le point de départ au milieu du segment haut
        const pts2 = [{x:CX,y:CY-H/2},{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY+H/2},{x:CX,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts2[s].x + u*(pts2[s+1].x-pts2[s].x), y: pts2[s].y + u*(pts2[s+1].y-pts2[s].y) };
    }, 64));
    // Style 6 : Z asymétrique (barre haute plus courte, barre basse plus longue)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/4,y:CY-H/2},{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY+H/2},{x:CX+W/4,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 7 : Z asymétrique miroir
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/2,y:CY-H/2},{x:CX+W/4,y:CY-H/2},{x:CX-W/4,y:CY+H/2},{x:CX+W/2,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 8 : Z diagonale très prononcée (segments courts, grosse diagonale)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX,y:CY-H/2},{x:CX+W/2,y:CY-H/2},{x:CX-W/2,y:CY+H/2},{x:CX,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));
    // Style 9 : Z ARRONDI — segments horizontaux courbés (coins arrondis)
    T.push(makeTemplate("Z", t => {
        if (t < 0.3) {
            // Barre haute : légèrement courbée
            const u = t / 0.3;
            return { x: CX - W/2 + u * W, y: CY - H/2 + Math.sin(u * Math.PI) * H * 0.05 };
        }
        if (t < 0.7) {
            // Diagonale : du coin haut-droit vers le coin bas-gauche
            const u = (t - 0.3) / 0.4;
            return { x: CX + W/2 - u * W, y: CY - H/2 + u * H };
        }
        // Barre basse
        const u = (t - 0.7) / 0.3;
        return { x: CX - W/2 + u * W, y: CY + H/2 - Math.sin(u * Math.PI) * H * 0.05 };
    }, 64));
    // Style 10 : Z plus haut que large (format portrait)
    T.push(makeTemplate("Z", t => {
        const pts = [{x:CX-W/3,y:CY-H/2},{x:CX+W/3,y:CY-H/2},{x:CX-W/3,y:CY+H/2},{x:CX+W/3,y:CY+H/2}];
        const seg = t * 3; const s = Math.min(Math.floor(seg), 2); const u = seg - s;
        return { x: pts[s].x + u*(pts[s+1].x-pts[s].x), y: pts[s].y + u*(pts[s+1].y-pts[s].y) };
    }, 64));

    // Style 1 : S fluide (sinus) de haut en bas, courbure à droite d'abord
    T.push(makeTemplate("S", t => ({
        x: CX + Math.sin(t * 2 * Math.PI) * W/3,
        y: CY - H/2 + t * H
    }), 64));
    // Style 2 : S miroir (courbure à gauche d'abord)
    T.push(makeTemplate("S", t => ({
        x: CX - Math.sin(t * 2 * Math.PI) * W/3,
        y: CY - H/2 + t * H
    }), 64));
    // Style 3 : S plus marqué (amplitude grande)
    T.push(makeTemplate("S", t => ({
        x: CX + Math.sin(t * 2 * Math.PI) * W/2.2,
        y: CY - H/2 + t * H
    }), 64));
    // Style 4 : S miroir plus marqué
    T.push(makeTemplate("S", t => ({
        x: CX - Math.sin(t * 2 * Math.PI) * W/2.2,
        y: CY - H/2 + t * H
    }), 64));
    // Style 5 : S ANGULEUX — 2 diagonales qui se croisent (comme un S dessiné vite)
    // Commence haut-droite, descend vers bas-gauche (1ère diagonale),
    // puis repart vers bas-droite (2ème diagonale)
    T.push(makeTemplate("S", t => {
        if (t < 0.5) {
            const u = t * 2;
            return { x: CX + W/3 - u * W * 2/3, y: CY - H/2 + u * H }; // droit→gauche en descendant
        }
        const u = (t-0.5)*2;
        return { x: CX - W/3 + u * W * 2/3, y: CY + u * H/2 }; // gauche→droit en descendant
    }, 64));
    // Style 6 : S anguleux miroir (commence haut-gauche, va vers bas-droit, puis bas-gauche)
    T.push(makeTemplate("S", t => {
        if (t < 0.5) {
            const u = t * 2;
            return { x: CX - W/3 + u * W * 2/3, y: CY - H/2 + u * H }; // gauche→droit
        }
        const u = (t-0.5)*2;
        return { x: CX + W/3 - u * W * 2/3, y: CY + u * H/2 }; // droit→gauche
    }, 64));
    // Style 7 : S anguleux avec croisement plus centré
    T.push(makeTemplate("S", t => {
        if (t < 0.5) {
            const u = t * 2;
            return { x: CX + W/2 - u * W, y: CY - H/2 + u * H }; // W/2 → -W/2
        }
        const u = (t-0.5)*2;
        return { x: CX - W/2 + u * W, y: CY + u * H/2 }; // -W/2 → W/2
    }, 64));
    // Style 8 : S court (amplitude réduite)
    T.push(makeTemplate("S", t => ({
        x: CX + Math.sin(t * 2 * Math.PI) * W/4,
        y: CY - H/2 + t * H
    }), 64));

    // INFINI : 4 templates couvrant les variantes de dessin humain
    // Template 1 : lemniscate mathématique (sens horaire depuis le centre)
    T.push(makeTemplate("INFINI", t => {
        const angle = t * 2 * Math.PI;
        const scale = 1 / (1 + Math.sin(angle) * Math.sin(angle));
        return {
            x: CX + Math.cos(angle) * scale * W/2,
            y: CY + Math.sin(angle) * Math.cos(angle) * scale * H/2
        };
    }, 80));
    // Template 2 : figure-8 dessiné naturellement — boucle gauche d'abord (sens habituel humain)
    // Démarre en haut-gauche, fait la boucle gauche, croise au centre, fait la boucle droite
    T.push(makeTemplate("INFINI", t => {
        if (t < 0.5) {
            // Boucle gauche : ellipse autour de (CX-W/4, CY)
            const a = t / 0.5 * 2 * Math.PI;
            return { x: CX - W/4 + Math.cos(a) * W/4, y: CY + Math.sin(a) * H/3 };
        } else {
            // Boucle droite : ellipse autour de (CX+W/4, CY) dans l'autre sens
            const a = (1 - (t - 0.5) / 0.5) * 2 * Math.PI;
            return { x: CX + W/4 + Math.cos(a) * W/4, y: CY + Math.sin(a) * H/3 };
        }
    }, 80));
    // Template 3 : démarrage depuis le côté gauche (comme la photo)
    T.push(makeTemplate("INFINI", t => {
        // Commence milieu-gauche, remonte, croise, fait boucle droite, revient
        const a = t * 2 * Math.PI + Math.PI; // Déphasage de PI pour commencer depuis côté gauche
        const scale = 1 / (1 + Math.sin(a) * Math.sin(a));
        return {
            x: CX + Math.cos(a) * scale * W/2,
            y: CY + Math.sin(a) * Math.cos(a) * scale * H/2
        };
    }, 80));
    // Template 4 : figure-8 allongé horizontalement comme dessiné rapidement à la main
    T.push(makeTemplate("INFINI", t => {
        const a = t * 2 * Math.PI;
        return {
            x: CX + Math.sin(a) * W/2,
            y: CY + Math.sin(2 * a) * H/4
        };
    }, 80));

    // COEUR template 1 : paramétrisation classique d'un cœur
    T.push(makeTemplate("COEUR", t => {
        const angle = t * 2 * Math.PI - Math.PI; // Commence en bas
        return {
            x: CX + (16 * Math.pow(Math.sin(angle), 3)) * (W / 32),
            y: CY - (13*Math.cos(angle) - 5*Math.cos(2*angle) - 2*Math.cos(3*angle) - Math.cos(4*angle)) * (H / 30)
        };
    }, 64));
    // COEUR template 2 : démarre en haut au milieu, bosse gauche, pointe basse, bosse droite
    T.push(makeTemplate("COEUR", t => {
        if (t < 0.5) {
            // Arc gauche : du centre-haut vers la pointe basse en passant par la gauche
            const u = t * 2;
            const a = Math.PI/2 + u * Math.PI * 1.5;
            return { x: CX - W/4 + Math.cos(a) * W/4, y: CY - H/6 + Math.sin(a) * H/3 };
        }
        // Arc droit : de la pointe basse vers le centre-haut en passant par la droite
        const u = (t - 0.5) * 2;
        const a = -Math.PI/2 + u * Math.PI * 1.5;
        return { x: CX + W/4 + Math.cos(a) * W/4, y: CY - H/6 + Math.sin(a) * H/3 };
    }, 64));
    // COEUR template 3 : dessin naturel depuis haut-gauche (bosse gauche d'abord)
    T.push(makeTemplate("COEUR", t => {
        if (t < 0.35) {
            // Bosse gauche : arc de haut-gauche vers le creux central
            const u = t / 0.35;
            const a = Math.PI * 1.1 + u * Math.PI * 0.8; // de ~200° à ~340°
            return { x: CX - W/4 + Math.cos(a) * W/3, y: CY - H/4 + Math.sin(a) * H/4 };
        }
        if (t < 0.65) {
            // Diagonale vers la pointe basse
            const u = (t - 0.35) / 0.30;
            return { x: CX - W/3 + u * W/3, y: CY + u * H/2 };
        }
        // Diagonale remontant vers haut-droite et bosse droite
        const u = (t - 0.65) / 0.35;
        const a = Math.PI * 0.5 - u * Math.PI * 0.8;
        return { x: CX + W/4 + Math.cos(a) * W/3, y: CY - H/4 + Math.sin(a) * H/4 };
    }, 64));
    // COEUR template 4 : cœur simplifié (deux arcs circulaires + pointe)
    T.push(makeTemplate("COEUR", t => {
        if (t < 0.25) {
            const u = t / 0.25;
            const a = Math.PI/2 + u * Math.PI;
            return { x: CX - W/4 + Math.cos(a) * W/4, y: CY - H/6 + Math.sin(a) * H/4 };
        }
        if (t < 0.50) {
            const u = (t - 0.25) / 0.25;
            return { x: CX - u * W/2, y: CY - H/6 + H/4 + u * H/2.5 };
        }
        if (t < 0.75) {
            const u = (t - 0.50) / 0.25;
            return { x: CX - W/2 + u * W/2, y: CY - H/6 + H/4 + (1-u) * H/2.5 };
        }
        const u = (t - 0.75) / 0.25;
        const a = Math.PI/2 - u * Math.PI;
        return { x: CX + W/4 + Math.cos(a) * W/4, y: CY - H/6 + Math.sin(a) * H/4 };
    }, 64));
    // SPIRALE : dessinée depuis le centre vers l'extérieur (ou vice versa)
    // Template 1 : spirale CCW partant du centre, s'élargissant (2 tours)
    T.push(makeTemplate("SPIRALE", t => {
        const a = -t * 4 * Math.PI;  // 2 tours CCW
        const r = t * W / 2;         // rayon croissant de 0 à W/2
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));
    // Template 2 : spirale CW partant du centre (sens inverse)
    T.push(makeTemplate("SPIRALE", t => {
        const a = t * 4 * Math.PI;   // 2 tours CW
        const r = t * W / 2;
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));
    // Template 3 : spirale CCW partant de l'extérieur vers le centre
    T.push(makeTemplate("SPIRALE", t => {
        const a = -t * 4 * Math.PI;
        const r = (1 - t) * W / 2;  // rayon décroissant
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));
    // Template 4 : spirale CW depuis l'extérieur vers le centre
    T.push(makeTemplate("SPIRALE", t => {
        const a = t * 4 * Math.PI;
        const r = (1 - t) * W / 2;
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));
    // Template 5 : spirale CCW 1.5 tours (dessin rapide)
    T.push(makeTemplate("SPIRALE", t => {
        const a = -t * 3 * Math.PI;  // 1.5 tours
        const r = t * W / 2;
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));
    // Template 6 : spirale CW 1.5 tours depuis l'extérieur
    T.push(makeTemplate("SPIRALE", t => {
        const a = t * 3 * Math.PI;
        const r = (1 - t) * W / 2;
        return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
    }, 80));


    return T;
}

const DOLLAR_TEMPLATES = buildTemplates();

/**
 * Compte le nombre de "coins" (changements de direction nets) dans un tracé.
 * Utilise une fenêtre glissante pour calculer l'angle local en chaque point.
 */
function estimateCornerCount(points) {
    const N = points.length;
    const k = Math.max(3, Math.floor(N / 14)); // Fenêtre de comparaison
    const ANGLE_THRESHOLD = Math.PI * 0.38;    // ~68° — angle minimum pour un "coin"
    const MIN_SEPARATION = Math.floor(N / 7);  // Distance minimale entre deux coins

    // 1. Calculer l'angle à chaque point
    const angles = new Array(N).fill(0);
    for (let i = k; i < N - k; i++) {
        const v1 = { x: points[i].x - points[i - k].x, y: points[i].y - points[i - k].y };
        const v2 = { x: points[i + k].x - points[i].x, y: points[i + k].y - points[i].y };
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 < 0.01 || mag2 < 0.01) continue;
        const cosA = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
        angles[i] = Math.acos(Math.max(-1, Math.min(1, cosA)));
    }

    // 2. Trouver les maxima locaux au-dessus du seuil (ce sont les coins)
    let corners = 0;
    let lastCornerIdx = -MIN_SEPARATION;
    for (let i = k; i < N - k; i++) {
        if (angles[i] < ANGLE_THRESHOLD) continue;
        // Vérifier que c'est un maximum local dans la fenêtre MIN_SEPARATION
        let isMax = true;
        const winStart = Math.max(k, i - MIN_SEPARATION);
        const winEnd = Math.min(N - k - 1, i + MIN_SEPARATION);
        for (let j = winStart; j <= winEnd; j++) {
            if (j !== i && angles[j] > angles[i]) { isMax = false; break; }
        }
        if (isMax && (i - lastCornerIdx) >= MIN_SEPARATION) {
            corners++;
            lastCornerIdx = i;
        }
    }
    return corners;
}

/**
 * Reconnaissance de formes via l'algorithme $1 Unistroke Recognizer
 * + comptage de coins pour distinguer TRIANGLE (3) et CARRE (4).
 */
function detectShape(rawPoints) {
    if (!_shapeDetectionActive || rawPoints.length < 5) return null;

    const totalLen = pathLength(rawPoints);
    if (totalLen < 20) return null;

    // Rééchantillonner pour le comptage de coins (avant normalisation)
    const sampledForCounting = dollar_resample([...rawPoints], 64);
    const rawCornerCount = estimateCornerCount(sampledForCounting);

    // CORRECTION FORMES FERMÉES : le coin de départ/fermeture est toujours perdu
    // car il tombe à la frontière du tableau (index 0 ou 63).
    // On détecte si la forme est fermée en comparant distance début-fin à la longueur totale.
    const startPt = sampledForCounting[0];
    const endPt   = sampledForCounting[sampledForCounting.length - 1];
    const closureDist = distance(startPt, endPt);
    const bbW = Math.max(...sampledForCounting.map(p => p.x)) - Math.min(...sampledForCounting.map(p => p.x));
    const bbH = Math.max(...sampledForCounting.map(p => p.y)) - Math.min(...sampledForCounting.map(p => p.y));
    const bbDiag = Math.sqrt(bbW * bbW + bbH * bbH) || 1;
    // Forme fermée : la distance start-end est faible ET les extrémités sont proches
    // HORIZONTALEMENT (un U a ses bras écartés, un cercle revient au même endroit)
    const startEndDx = Math.abs(endPt.x - startPt.x);
    const isClosed = closureDist < bbDiag * 0.5  // Les extrémités sont proches en distance
                  && startEndDx < bbW * 0.45;    // ET elles ne sont pas écartées horizontalement (sinon c'est un U)

    // Si la forme est fermée ET a 3 coins comptés → le 4ème coin (de fermeture) a été raté
    // → traiter comme 4 coins
    const cornerCount = (isClosed && rawCornerCount === 3) ? 4 : rawCornerCount;
    console.log(`[SHAPE] Corners: raw=${rawCornerCount} corrected=${cornerCount} closed=${isClosed}`);

    // LINÉARITÉ : écart perpendiculaire max normalisé par la longueur de la corde.
    // Une ligne droite = 0.0, une forme complexe = 0.5+
    const p0 = sampledForCounting[0];
    const p1 = sampledForCounting[sampledForCounting.length - 1];
    const chordDx = p1.x - p0.x;
    const chordDy = p1.y - p0.y;
    const chordLen = Math.sqrt(chordDx * chordDx + chordDy * chordDy) || 1;
    let maxPerp = 0;
    for (const p of sampledForCounting) {
        const perp = Math.abs((p.y - p0.y) * chordDx - (p.x - p0.x) * chordDy) / chordLen;
        if (perp > maxPerp) maxPerp = perp;
    }
    const linearity = maxPerp / chordLen; // 0 = parfaitement droit
    const isLinear = linearity < 0.18 && !isClosed; // Droit et non fermé
    console.log(`[SHAPE] Linearity: ${linearity.toFixed(3)} isLinear=${isLinear}`);

    // Normaliser le tracé pour $1
    const candidate = dollar_normalize(rawPoints);

    // Seuils par forme
    const SHAPE_THRESHOLDS = {
        "INFINI":   70,
        "SPIRALE":  60,  // Modéré : spirale distincte du cercle grâce aux checks géométriques
        "COEUR":    52,  // Assoupli : tracé humain d'un cœur est imparfait
        "S":        65,  // Très tolérant : S anguleux ou courbé, variété élevée
        "Z":        60,  // Tolérant : Z imperfait avec coins arrondis
        "L":        60,
        "CARRE":    55,
        "CERCLE":   70,
        "TRIANGLE": 45,
        "U":        55,
        "DEFAULT":  50
    };

    // CONTRAINTE GÉOMÉTRIQUE
    function isAllowed(name) {
        if (isLinear) {
            return name === "LIGNE";
        }
        // SPIRALE : forme complexe unique — bypass tous les filtres de coins
        // Le template matching seul décide (seuil élevé)
        if (name === "SPIRALE") return true;
        // Fermé + AUCUN coin → CERCLE, COEUR ou INFINI seulement
        if (isClosed && cornerCount === 0) {
            const SMOOTH_CLOSED = new Set(["CERCLE", "COEUR", "INFINI"]);
            if (!SMOOTH_CLOSED.has(name)) return false;
        }
        // 0 coin + OUVERT → U, L, S, Z (Z arrondi peut avoir 0 coins détectés)
        if (cornerCount === 0 && !isClosed) {
            const SMOOTH_OPEN = new Set(["U", "L", "S", "Z"]);
            if (!SMOOTH_OPEN.has(name)) return false;
        }
        // 1 coin + ouvert → V, L, U, Z (Z avec 1 coin arrondi)
        if (cornerCount === 1 && !isClosed) {
            const ONE_CORNER_OPEN = new Set(["V", "L", "U", "Z"]);
            if (!ONE_CORNER_OPEN.has(name)) return false;
        }
        // 2 coins + ouvert → Z ou S uniquement
        // L est exclu (L = 0-1 coin max) — fix Z→L confusion
        if (cornerCount === 2 && !isClosed) {
            const TWO_CORNER_OPEN = new Set(["Z", "S"]);
            if (!TWO_CORNER_OPEN.has(name)) return false;
        }
        // 3 coins + ouvert → formes géométriques
        if (cornerCount === 3 && !isClosed) {
            const THREE_CORNER = new Set(["Z", "S", "TRIANGLE"]);
            if (!THREE_CORNER.has(name)) return false;
        }
        // 4+ coins ouvert → S et Z peuvent toujours être dessinés anguleusement avec 4+ inflexions
        if (cornerCount >= 4 && !isClosed) {
            const MANY_CORNER_OPEN = new Set(["S", "Z"]);  // S anguleux a 4+ points d'inflexion
            if (!MANY_CORNER_OPEN.has(name)) return false;
        }

        // 4+ coins fermé → formes complexes : CARRE ou COEUR (pointe + bosses = 3+ coins corrigés à 4)
        if (cornerCount >= 4 && isClosed) {
            if (name === "TRIANGLE") return false;
            if (name === "CERCLE") return false;
            // COEUR est autorisé : 3 coins (pointe + dip + bosses) corrigés à 4 par la règle
        }
        return true;
    }



    let bestScore = Infinity;
    let bestName = null;

    for (const template of DOLLAR_TEMPLATES) {
        if (!isAllowed(template.name)) continue;
        const d = dollar_distanceAtBestAngle(candidate, template, -ANGLE_RANGE, ANGLE_RANGE, ANGLE_PRECISION);
        const thr = SHAPE_THRESHOLDS[template.name] || SHAPE_THRESHOLDS["DEFAULT"];
        if (d < thr && d < bestScore) {
            bestScore = d;
            bestName = template.name;
        }
    }

    const threshold = SHAPE_THRESHOLDS[bestName] || SHAPE_THRESHOLDS["DEFAULT"];
    console.log(`[SHAPE] Best match: ${bestName} (score=${bestScore.toFixed(1)}, threshold=${threshold})`);

    // ─── VALIDATION DIRECTIONNELLE ──────────────────────────────────────────
    // Chaque forme a une orientation canonique. Si le tracé ne correspond pas
    // à cette orientation, on rejette la détection.
    if (bestName) {
        const pts = sampledForCounting;
        const N   = pts.length;
        const sX  = pts[0].x,     sY  = pts[0].y;
        const eX  = pts[N-1].x,   eY  = pts[N-1].y;
        const minY = Math.min(...pts.map(p => p.y));
        const maxY = Math.max(...pts.map(p => p.y));
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const H = maxY - minY || 1;
        const W = maxX - minX || 1;

        let directionOK = true;
        let rejectReason = "";

        switch (bestName) {
            case "V":
                // V : pointe en bas, start ET end dans la moitié supérieure (55%)
                directionOK = sY < minY + H * 0.55 && eY < minY + H * 0.55;
                rejectReason = `V: sY=${sY.toFixed(0)} eY=${eY.toFixed(0)} limit=${(minY + H * 0.55).toFixed(0)}`;
                break;

            case "U":
                // U : ouverture en haut, mais le bras droit peut ne pas remonter aussi haut
                // → au moins l'un des deux (start ou end) doit être dans le tiers supérieur
                //   ET les deux doivent être dans les 70% supérieurs
                directionOK = sY < minY + H * 0.70 && eY < minY + H * 0.70
                           && (sY < minY + H * 0.40 || eY < minY + H * 0.40);
                rejectReason = `U: sY=${sY.toFixed(0)} eY=${eY.toFixed(0)} limit70=${(minY + H * 0.70).toFixed(0)}`;
                break;

            case "L":
                // L : start clairement en haut, end en bas-droite
                // La position X du début n'est pas contrainte (diagonale possible)
                directionOK = sY < minY + H * 0.50    // commence dans la moitié supérieure
                           && eX > minX + W * 0.40    // finit du côté droit
                           && eY > minY + H * 0.50;   // finit en bas
                rejectReason = `L: sY=${sY.toFixed(0)} eX=${eX.toFixed(0)} eY=${eY.toFixed(0)}`;
                break;

            case "S": {
                // S : direction FIXE seulement (haut → bas)
                // Tolérant : le S peut débuter au milieu et finir sans aller tout en bas
                const sDirOK = sY < minY + H * 0.55 && eY > minY + H * 0.45;
                // S peut être relativement large : ratio assoupli
                const sAspectOK = H > W * 0.30;
                // S oscille latéralement : la moyenne X de la moitié haute ≠ moitié basse
                const midYS = (minY + maxY) / 2;
                const topPts = pts.filter(p => p.y < midYS);
                const botPts = pts.filter(p => p.y >= midYS);
                const avgXTop = topPts.reduce((sum, p) => sum + p.x, 0) / (topPts.length || 1);
                const avgXBot = botPts.reduce((sum, p) => sum + p.x, 0) / (botPts.length || 1);
                const lateralSepS = Math.abs(avgXTop - avgXBot) / (W || 1);
                const sLateralOK = lateralSepS > 0.08;  // 8% de séparation minimale
                directionOK = sDirOK && sAspectOK && sLateralOK;
                rejectReason = `S: dir=${sDirOK} aspect=${H.toFixed(0)}>${(W*0.30).toFixed(0)} lateral=${lateralSepS.toFixed(2)}>0.08`;
                break;
            }

            case "Z": {
                // Z canonique : commence en haut, finit en bas-droite
                const zDirOK = sY < minY + H * 0.50
                            && eY > minY + H * 0.50
                            && eX > minX + W * 0.40;
                // Z latéral : les barres horizontales restent du même côté
                // → séparation X faible entre moitié haute et basse (contrairement à S)
                const midYZ = (minY + maxY) / 2;
                const topPtsZ = pts.filter(p => p.y < midYZ);
                const botPtsZ = pts.filter(p => p.y >= midYZ);
                const avgXTopZ = topPtsZ.reduce((sum, p) => sum + p.x, 0) / (topPtsZ.length || 1);
                const avgXBotZ = botPtsZ.reduce((sum, p) => sum + p.x, 0) / (botPtsZ.length || 1);
                const lateralSepZ = Math.abs(avgXTopZ - avgXBotZ) / (W || 1);
                // Z : séparation modérée (pas une forte oscillation S)
                const zLateralOK = lateralSepZ < 0.45;
                directionOK = zDirOK && zLateralOK;
                rejectReason = `Z: dir=${zDirOK} lateral=${lateralSepZ.toFixed(2)}<0.45(top=${avgXTopZ.toFixed(0)} bot=${avgXBotZ.toFixed(0)})`;
                break;
            }




            case "INFINI":
                // ∞ couché : plus large que haut (ratio largeur/hauteur > 1.2)
                directionOK = W > H * 1.0; // Pas trop strict, un ∞ peut être presque carré
                rejectReason = `INFINI: W=${W.toFixed(0)} H=${H.toFixed(0)}`;
                break;

            case "COEUR":
                // Forme fermée → on peut démarrer n'importe où (pointe basse, bosse haute, etc.)
                // Le template matching suffit à identifier la forme
                directionOK = true;
                break;

            case "SPIRALE": {
                // Spirale ≠ Cercle : vérifier que le rayon VARIE entre le début et la fin
                const cx = rawPoints.reduce((s, p) => s + p.x, 0) / rawPoints.length;
                const cy = rawPoints.reduce((s, p) => s + p.y, 0) / rawPoints.length;
                const rStart = Math.hypot(rawPoints[0].x - cx, rawPoints[0].y - cy);
                const rEnd   = Math.hypot(rawPoints[rawPoints.length-1].x - cx, rawPoints[rawPoints.length-1].y - cy);
                const rMax   = Math.max(rStart, rEnd, 1);
                const rDiff  = Math.abs(rStart - rEnd) / rMax;
                // Cercle : rStart ≈ rEnd → rDiff < 0.25 → rejeter comme spirale
                // Spirale : rStart très différent de rEnd → rDiff ≥ 0.25
                const spiralRadiusOK = rDiff >= 0.25;
                // Cercle fermé → jamais une spirale
                const spiralNotClosed = !isClosed;
                directionOK = spiralNotClosed && spiralRadiusOK;
                rejectReason = `SPIRALE: isClosed=${isClosed} rDiff=${rDiff.toFixed(2)}(rS=${rStart.toFixed(0)} rE=${rEnd.toFixed(0)})`;
                break;
            }
            default:
                directionOK = true;
        }

        if (!directionOK) {
            console.log(`[SHAPE] ${bestName} rejected by direction check: ${rejectReason}`);
            bestName = null;
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    if (bestName) {
        let sumX = 0, sumY = 0;
        rawPoints.forEach(p => { sumX += p.x; sumY += p.y; });
        const cx = sumX / rawPoints.length;
        const cy = sumY / rawPoints.length;

        // showToast(`Tracé : ${bestName} (${bestScore.toFixed(0)})`);
        if (window.onShapeDetected) window.onShapeDetected(bestName, cx, cy);
        return bestName;
    }
    return null;
}
