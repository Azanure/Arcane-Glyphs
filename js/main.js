/**
 * main.js — Point d'entrée simplifié.
 * Crée le moteur Babylon.js, initialise le tracking/menu,
 * puis délègue tout à SceneManager.
 */

import { SceneManager } from "./SceneManager.js";
import { initTracking, startShapeDetection } from "./tracking.js";
import { initMenu } from "./menu.js";

// Import pour initialiser les globals nécessaires
import { loadoutManager } from "./managers/LoadoutManager.js";

document.addEventListener("DOMContentLoaded", () => {
  // ── Éléments DOM ──────────────────────────────────────────────────────────
  const renderCanvas = document.getElementById("renderCanvas");
  const drawingCanvas = document.getElementById("drawingCanvas");
  const videoElement = document.getElementById("videoElement");
  const magicCursor = document.getElementById("magicCursor");

  // ── Tracking (MediaPipe / souris debug) ───────────────────────────────────
  initTracking(videoElement, drawingCanvas, magicCursor);
  startShapeDetection();

  function resizeDrawingCanvas() {
    if (drawingCanvas) {
      drawingCanvas.width = window.innerWidth;
      drawingCanvas.height = window.innerHeight;
    }
  }
  window.addEventListener("resize", resizeDrawingCanvas);
  resizeDrawingCanvas();

  // ── Moteur Babylon.js ─────────────────────────────────────────────────────
  const engine = new BABYLON.Engine(renderCanvas, true);
  window.addEventListener("resize", () => engine.resize());

  // Inspecteur Babylon (touche "i") — fonctionne sur la scène active
  window.addEventListener("keydown", (ev) => {
    if (ev.key.toLowerCase() !== "i") return;
    const scene = window.sceneManager?.currentScene?.scene;
    if (!scene) return;
    if (scene.metadata?.disableInspector) return;
    if (scene.debugLayer.isVisible()) {
      scene.debugLayer.hide();
    } else {
      scene.debugLayer.show({
        embedMode: false,
        handleResize: true,
        enablePopup: true,
      });
    }
  });

  // ── Menu principal ────────────────────────────────────────────────────────
  // window.onGameStart est appelé par menu.js quand le joueur clique "New Game" / "Continue"
  window.onGameStart = async (_isContinue) => {
    const sceneManager = new SceneManager(engine);
    window.sceneManager = sceneManager;
    
    if (_isContinue) {
        try {
            const savedData = localStorage.getItem('arcane_glyphs_save'); // using STORAGE_SAVE_KEY
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.character) {
                    sceneManager.sharedState.selectedCharacterName = parsed.character;
                }
            }
        } catch(e) {}
    }
    
    await sceneManager.goToHub();
  };

  initMenu();

  console.log("[Main] Arcane Glyphs — prêt.");
});
