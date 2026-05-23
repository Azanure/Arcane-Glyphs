/**
 * HubScene — Scène du Hub (spawn, carrousel personnages, autel de sorts).
 * Complètement indépendante de LevelScene.
 */

import { Player } from "../entities/Player.js";
import { CameraManager } from "../managers/CameraManager.js";
import { InputManager } from "../managers/InputManager.js";
import { CharacterCarouselManager } from "../managers/CharacterCarouselManager.js";
import { LoadoutUI } from "../ui/LoadoutUI.js";
import { PauseManager } from "../managers/PauseManager.js";

export class HubScene {
  constructor(engine, sharedState) {
    this.engine = engine;
    this.sharedState = sharedState;
    this.scene = new BABYLON.Scene(engine);
    this._disposed = false;

    // Callback vers SceneManager
    this.onEnterPortal = null;

    // Objets 3D du hub
    this.portal = null;
    this.spellAltar = null;
    this.characterAltar = null;

    // Systèmes
    this.player = null;
    this.cameraManager = null;
    this.inputManager = null;
    this.loadoutUI = null;
    this.carouselManager = null;
    this.characterTemplates = {};
    this.hubAssets = new Map();
    this.pauseManager = null;

    // État interne
    this.inCharacterSelection = false;
    this.gameTime = 0;
    this._lastRealTime = performance.now();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────────────────────────────────
  async init() {
    this._setupLights();
    await this._loadHubAssets();
    this._createGround();
    await this._loadCharacterAssets();
    this._createPlayer();
    this._createCamera();
    await this._createHubObjects();
    this._createCarousel();
    this._setupLoadoutUI();
    this._setupDOMForHub();
    this._setupGlobals();

    this.pauseManager = new PauseManager(null, true);

    console.log("[HubScene] Initialisée.");
  }

  _setupLights() {
    const light = new BABYLON.HemisphericLight(
      "hubAmbient",
      new BABYLON.Vector3(0, 1, 0),
      this.scene,
    );
    light.intensity = 0.8;
    light.diffuse = new BABYLON.Color3(1, 0.95, 0.9);
    light.groundColor = new BABYLON.Color3(0.3, 0.15, 0.05);

    const sun = new BABYLON.DirectionalLight(
      "hubSun",
      new BABYLON.Vector3(-1, -2, -1),
      this.scene,
    );
    sun.intensity = 0.6;
    sun.diffuse = new BABYLON.Color3(1, 0.9, 0.7);
  }

  async _loadHubAssets() {
    console.log("[HubScene] Chargement de temple_assets.glb...");
    try {
      const res = await BABYLON.SceneLoader.ImportMeshAsync(
        "",
        "assets/temple/",
        "temple_assets.glb",
        this.scene,
      );
      res.meshes[0].setEnabled(false);

      // Stocker tout ce qui a un nom dans hubAssets (Meshes et TransformNodes)
      for (let mesh of res.meshes) {
        if (mesh.name === "__root__") continue;
        mesh.setEnabled(true);
        mesh.isVisible = false;
        this.hubAssets.set(mesh.name, mesh);
      }

      // Si floor_B n'est pas un Mesh direct, il est peut-être dans les transformNodes
      for (let node of res.transformNodes) {
        this.hubAssets.set(node.name, node);
      }

      console.log(`[HubScene] Assets chargés. Total : ${this.hubAssets.size}`);
    } catch (e) {
      console.error("[HubScene] Erreur temple_assets.glb", e);
    }
  }

  _createGround() {
    // Sol physique invisible pour les collisions
    const ground = BABYLON.MeshBuilder.CreateGround(
      "hubGroundPhysics",
      { width: 30, height: 30 },
      this.scene,
    );
    ground.isVisible = false;
    ground.position.y = -0.01;
    ground.checkCollisions = true;

    // Recherche de floor_B de manière flexible
    let floorSource =
      this.scene.getMeshByName("floor_B") || this.hubAssets.get("floor_B");

    // Si pas trouvé par nom exact, on cherche un nom approchant (insensible à la casse)
    if (!floorSource) {
      for (let [name, asset] of this.hubAssets) {
        if (name.toLowerCase().includes("floor_b")) {
          floorSource = asset;
          break;
        }
      }
    }

    // Si c'est un transform spécial/groupe, on cherche son premier enfant mesh
    if (floorSource && !(floorSource instanceof BABYLON.Mesh)) {
      const meshes = floorSource.getChildMeshes();
      if (meshes.length > 0) floorSource = meshes[0];
    }

    if (floorSource) {
      floorSource.setEnabled(true);
      floorSource.isVisible = false;
    }

    if (!floorSource) {
      console.warn("[HubScene] floor_B non trouvé, fallback");
      ground.isVisible = true;
      const mat = new BABYLON.StandardMaterial("hubMat", this.scene);
      mat.diffuseColor = new BABYLON.Color3(0.15, 0.45, 0.15);
      mat.specularColor = new BABYLON.Color3(0, 0, 0);
      ground.material = mat;
      ground.position.y = -0.01;
      return;
    }

    const size = 30; // 15 tuiles de 2m
    const tileSize = 2.0;
    const count = Math.ceil(size / tileSize);

    // Création d'un parent pour les tiles pour optimiser
    const floorRoot = new BABYLON.TransformNode("floorRoot", this.scene);

    // Calcul de l'offset Y pour que la SURFACE du sol soit à Y=0
    const boundingInfo = floorSource.getBoundingInfo();
    const maxY = boundingInfo.boundingBox.maximumWorld.y;
    const yOffset = -maxY;

    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        const inst = floorSource.createInstance
          ? floorSource.createInstance(`floor_${i}_${j}`)
          : floorSource.clone(`floor_${i}_${j}`);

        inst.parent = floorRoot;
        inst.isVisible = true;

        // Centrage
        const posX = (i - count / 2) * tileSize + tileSize / 2;
        const posZ = (j - count / 2) * tileSize + tileSize / 2;

        inst.position.set(posX, yOffset, posZ);
      }
    }
    console.log(
      `[HubScene] Sol généré avec ${count * count} tiles. Source : ${floorSource.name}`,
    );

    this._createWalls(size, tileSize);
  }

  _createWalls(groundSize, tileSize) {
    let wallSource =
      this.scene.getMeshByName("wall_A") || this.hubAssets.get("wall_A");

    if (!wallSource) {
      for (let [name, asset] of this.hubAssets) {
        if (name.toLowerCase().includes("wall_a")) {
          wallSource = asset;
          break;
        }
      }
    }

    if (!wallSource) {
      console.warn("[HubScene] wall_A non trouvé pour les murs");
      return;
    }

    // Activer la source
    wallSource.setEnabled(true);
    if (wallSource.getChildMeshes) {
      wallSource.getChildMeshes().forEach((child) => {
        child.setEnabled(true);
        child.isVisible = false;
      });
    } else {
      wallSource.isVisible = false;
    }

    // Calcul de l'offset Y pour que la BASE du mur soit à Y=0
    let minY = Infinity;
    const children = wallSource.getChildMeshes
      ? wallSource.getChildMeshes()
      : [];
    if (children.length > 0) {
      for (const child of children) {
        const bi = child.getBoundingInfo();
        const childMinY = bi.boundingBox.minimumWorld.y;
        if (childMinY < minY) minY = childMinY;
      }
    } else if (wallSource.getBoundingInfo) {
      minY = wallSource.getBoundingInfo().boundingBox.minimumWorld.y;
    } else {
      minY = 0;
    }
    const wallYOffset = -minY;

    const wallRoot = new BABYLON.TransformNode("wallRoot", this.scene);

    const count = 16; // 16 segments pour couvrir la distance avec chevauchement
    const halfSize = groundSize / 2; // 15.0

    // Premier segment centré à -14.25m, dernier à +14.25m (pour fermer les coins à 15.25m)
    const startPos = -14.25;
    const endPos = 14.25;
    const step = (endPos - startPos) / (count - 1); // 1.90m

    for (let i = 0; i < count; i++) {
      const pos = startPos + i * step;

      const createWall = (x, z, rotY) => {
        const inst = this._instantiatePrefab(wallSource, `wall_inst_${x}_${z}`);
        if (!inst) return;

        inst.parent = wallRoot;
        inst.position.set(x, wallYOffset, z);
        inst.rotation.y = rotY;

        // Activer les collisions sur toutes les parties du mur
        if (inst instanceof BABYLON.AbstractMesh) {
          inst.checkCollisions = true;
        }
        if (inst.getChildMeshes) {
          inst.getChildMeshes().forEach((child) => {
            child.checkCollisions = true;
          });
        }
      };

      // Mur Nord (Z+)
      createWall(pos, halfSize, 0);
      // Mur Sud (Z-)
      createWall(pos, -halfSize, Math.PI);
      // Mur Est (X+)
      createWall(halfSize, pos, Math.PI / 2);
      // Mur Ouest (X-)
      createWall(-halfSize, pos, -Math.PI / 2);
    }

    console.log(
      `[HubScene] Murs générés tout autour du hub avec fermeture des angles.`,
    );
  }

  _instantiatePrefab(source, name) {
    if (!source) return null;

    const children = source.getChildMeshes ? source.getChildMeshes() : [];
    if (children.length === 0) {
      const inst = source.createInstance
        ? source.createInstance(name)
        : source.clone(name);
      if (inst) inst.isVisible = true;
      return inst;
    }

    const rootInst = new BABYLON.TransformNode(name, this.scene);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childInst = child.createInstance
        ? child.createInstance(`${name}_part_${i}`)
        : child.clone(`${name}_part_${i}`);

      if (childInst) {
        childInst.parent = rootInst;
        childInst.isVisible = true;
      }
    }
    return rootInst;
  }

  async _loadCharacterAssets() {
    const charNames = ["azir", "brand", "kayle", "tung tung", "xerath"];
    for (const name of charNames) {
      try {
        const baseUrl = `assets/characters/player/${name}/`;
        const res = await BABYLON.SceneLoader.ImportMeshAsync(
          "",
          baseUrl,
          `${name}.glb`,
          this.scene,
        );
        res.meshes[0].setEnabled(false);
        
        const charData = {
          mesh: res.meshes[0],
          animationGroups: res.animationGroups,
        };
        
        try {
            charData.idleContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("", baseUrl + "idle.glb", this.scene);
        } catch(e) {}
        
        try {
            charData.runContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync("", baseUrl + "running.glb", this.scene);
        } catch(e) {}

        this.characterTemplates[name] = charData;
      } catch (err) {
        console.warn(`[HubScene] Impossible de charger : ${name}`, err);
      }
    }
    // Expose en global pour Player.js (setupBrandVisual utilise window.characterTemplates)
    window.characterTemplates = this.characterTemplates;
    console.log("[HubScene] Personnages chargés.");
  }

  _createPlayer() {
    this.inputManager = new InputManager();
    this.player = new Player(this.scene, this.sharedState);
    this.player.mesh.position = new BABYLON.Vector3(0, 0, 0);
    window.player = this.player;
  }

  _createCamera() {
    this.cameraManager = new CameraManager(this.scene);
    this.cameraManager.setTarget(this.player.mesh);
  }

  async _createHubObjects() {
    // — PORTAIL —
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "assets/worlds/hub/",
            "portal.glb",
            this.scene
        );
        this.portal = result.meshes[0];
        this.portal.position = new BABYLON.Vector3(0, 0, 10);
        this.portal.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
        
        if (this.portal.rotationQuaternion) {
            this.portal.rotationQuaternion = null;
        }

        this.portal.computeWorldMatrix(true);
        result.meshes.forEach(m => m.computeWorldMatrix(true));

        let minY = Infinity;
        const meshesToCheck = result.meshes.filter(m => m !== this.portal && m.getTotalVertices() > 0);
        if (meshesToCheck.length === 0) meshesToCheck.push(this.portal);
        
        for (const m of meshesToCheck) {
            const childMinY = m.getBoundingInfo().boundingBox.minimumWorld.y;
            if (childMinY < minY) minY = childMinY;
        }
        
        this.portal.position.y += -minY;
    } catch (err) {
        console.error("Impossible de charger portal.glb", err);
        this.portal = BABYLON.MeshBuilder.CreateCylinder("portal", { height: 4, diameter: 3 }, this.scene);
        this.portal.position = new BABYLON.Vector3(0, 2, 10);
        const portalMat = new BABYLON.StandardMaterial("portalMat", this.scene);
        portalMat.emissiveColor = new BABYLON.Color3(0, 0.5, 1);
        portalMat.alpha = 0.7;
        this.portal.material = portalMat;
    }

    // — AUTEL SORTS —
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "assets/worlds/hub/",
            "book_altar_separated.glb",
            this.scene
        );
        this.spellAltar = result.meshes[0];
        this.spellAltar.position = new BABYLON.Vector3(10, 0, 0);
        this.spellAltar.scaling = new BABYLON.Vector3(1.5, 1.5, 1.5);
        
        // Force calculation of world matrices to get accurate bounding boxes
        this.spellAltar.computeWorldMatrix(true);
        result.meshes.forEach(m => m.computeWorldMatrix(true));

        // Find the altar and book meshes to calculate the ground offset and rotation
        const altarMesh = result.meshes.find(m => m.name.toLowerCase().includes('altar') && m !== this.spellAltar);
        
        // Try finding by name, otherwise take any mesh that is not the altar or root and has geometry
        this.bookMesh = result.meshes.find(m => m.name.toLowerCase().includes('book') && m !== this.spellAltar) 
                     || result.meshes.find(m => m !== this.spellAltar && m !== altarMesh && m.getTotalVertices() > 0);
        
        if (this.bookMesh) {
            // GLB uses rotationQuaternion by default, which overrides rotation.
            // We set it to null so we can manipulate rotation.y directly.
            this.bookMesh.rotationQuaternion = null;
        }
        
        if (altarMesh) {
            let minY = Infinity;
            const meshesToCheck = altarMesh.getChildMeshes(false);
            if (meshesToCheck.length === 0) meshesToCheck.push(altarMesh);
            
            for (const m of meshesToCheck) {
                const childMinY = m.getBoundingInfo().boundingBox.minimumWorld.y;
                if (childMinY < minY) minY = childMinY;
            }
            
            // Shift the root node so the altar sits perfectly on the ground (y=0)
            // This simultaneously shifts the book by the exact same amount.
            this.spellAltar.position.y += -minY;
        }

    } catch (err) {
        console.error("Impossible de charger book_altar.glb", err);
        this.spellAltar = BABYLON.MeshBuilder.CreateBox("altar", { size: 3 }, this.scene);
        this.spellAltar.position = new BABYLON.Vector3(10, 1.5, 0);
        const altarMat = new BABYLON.StandardMaterial("altarMat", this.scene);
        altarMat.emissiveColor = new BABYLON.Color3(0.8, 0.2, 0.8);
        this.spellAltar.material = altarMat;
    }

    // — AUTEL PERSONNAGES —
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(
            "",
            "assets/worlds/hub/",
            "glass.glb",
            this.scene
        );
        this.characterAltar = result.meshes[0];
        this.characterAltar.position = new BABYLON.Vector3(-10, 0, 0);
        this.characterAltar.scaling = new BABYLON.Vector3(3, 3, 3);
        
        // Disable quaternion so we can rotate via Euler angles in the loop
        if (this.characterAltar.rotationQuaternion) {
            this.characterAltar.rotationQuaternion = null;
        }
        
        // Force world matrices to compute precise bounding boxes
        this.characterAltar.computeWorldMatrix(true);
        result.meshes.forEach(m => m.computeWorldMatrix(true));

        let minY = Infinity;
        const meshesToCheck = result.meshes.filter(m => m !== this.characterAltar && m.getTotalVertices() > 0);
        if (meshesToCheck.length === 0) meshesToCheck.push(this.characterAltar);
        
        for (const m of meshesToCheck) {
            const childMinY = m.getBoundingInfo().boundingBox.minimumWorld.y;
            if (childMinY < minY) minY = childMinY;
        }
        
        // Set at ground level + 1.0 for levitation
        this.characterAltar.position.y += -minY + 1.0;

    } catch (err) {
        console.error("Impossible de charger glass.glb", err);
        this.characterAltar = BABYLON.MeshBuilder.CreateCylinder("charAltar", { height: 1, diameter: 4 }, this.scene);
        this.characterAltar.position = new BABYLON.Vector3(-10, 0.5, 0);
        const charAltarMat = new BABYLON.StandardMaterial("charAltarMat", this.scene);
        charAltarMat.emissiveColor = new BABYLON.Color3(1, 0.84, 0);
        this.characterAltar.material = charAltarMat;
    }
  }

  _createCarousel() {
    const uiEl = {
      charName: document.getElementById("carouselCharName"),
      charClass: document.getElementById("carouselCharClass"),
      btnPrev: document.getElementById("btnPrevChar"),
      btnNext: document.getElementById("btnNextChar"),
      charBonusText: document.getElementById("charBonusText"),
      lockBanner: document.getElementById("carouselLockBanner"),
      lockCondition: document.getElementById("carouselLockCondition"),
      btnPlay: document.getElementById("btnPlayCharacter"),
      btnQuit: document.getElementById("btnQuitCarousel"),
    };

    const playCallback = (selectedChar) => {
      // Sauvegarder le personnage dans le state partagé
      this.sharedState.selectedCharacterName =
        selectedChar.modelName || "brand";

      // Mettre à jour le mesh du joueur immédiatement
      if (this.player && this.player.changeCharacterMesh) {
        this.player.changeCharacterMesh(selectedChar);
      }

      // Retourner au HUB visuel
      document
        .getElementById("characterSelectionScreen")
        .classList.add("hidden");
      this.inCharacterSelection = false;
      this.carouselManager.setVisible(false);

      this.portal.setEnabled(true);
      this.spellAltar.setEnabled(true);
      this.characterAltar.setEnabled(true);
      document.getElementById("hudSpells").classList.remove("hidden");

      if (this.player && this.player.mesh) {
        this.player.mesh.setEnabled(true);
        // Repositionner le joueur devant l'autel (hors zone de trigger 3m)
        this.player.mesh.position.set(-6, 0, 0);
      }
      this.cameraManager.setTarget(this.player.mesh);
    };

    this.carouselManager = new CharacterCarouselManager(
      this.scene,
      uiEl,
      playCallback,
    );

    const charsData = [
      {
        name: "Azir",
        className: "Empereur des Sables",
        modelName: "azir",
        unlocked: true,
        bonusText: "50% more damage for AIR spells"
      },
      {
        name: "Brand",
        className: "Vengeur Flamboyant",
        modelName: "brand",
        unlocked: true,
        bonusText: "50% more damage for FIRE spells"
      },
      {
        name: "Kayle",
        className: "Justicière Céleste",
        modelName: "kayle",
        unlocked: false,
        unlockCondition: "personnage bloqué pour l'instant",
        bonusText: "TBD"
      },
      {
        name: "Tung Tung",
        className: "Moine Aveugle",
        modelName: "tung tung",
        unlocked: false,
        unlockCondition: "personnage bloqué pour l'instant",
        bonusText: "TBD"
      },
      {
        name: "Xerath",
        className: "Mage Ascendant",
        modelName: "xerath",
        unlocked: false,
        unlockCondition: "personnage bloqué pour l'instant",
        bonusText: "TBD"
      },
    ];

    this.carouselManager.initCharacters(charsData, this.characterTemplates);
    this.carouselManager.setVisible(false);

    // Bouton quitter carrousel
    uiEl.btnQuit.addEventListener("click", () => {
      if (this.carouselManager.isAnimating) return;
      document
        .getElementById("characterSelectionScreen")
        .classList.add("hidden");
      this.inCharacterSelection = false;
      this.carouselManager.setVisible(false);
      this.portal.setEnabled(true);
      this.spellAltar.setEnabled(true);
      this.characterAltar.setEnabled(true);
      document.getElementById("hudSpells").classList.remove("hidden");

      if (this.player && this.player.mesh) {
        this.player.mesh.setEnabled(true);
        // Repositionner le joueur (hors zone de trigger 3m)
        this.player.mesh.position.set(-6, 0, 0);
      }
      this.cameraManager.setTarget(this.player.mesh);
    });
  }

  _setupLoadoutUI() {
    this.loadoutUI = new LoadoutUI();

    // Callback pour rafraîchir le HUD sorts après assignation
    window.updateActiveBindingsHub = () => {
      const loadout = window.loadoutManager.getLoadout();
      const hudSpellsContainer = document.getElementById("hudSpells");
      if (!hudSpellsContainer) return;
      
      hudSpellsContainer.innerHTML = ''; // Clear previous slots
      window.activeSpellIds = [];

      Object.entries(loadout.bindings).forEach(([shapeKey, spell]) => {
        if (!spell) return; // Ignore empty slots

        window.activeSpellIds.push(spell.id);

        const shapeConfig = window.RuneDatabase ? window.RuneDatabase[shapeKey] : null;
        const traceIcon = shapeConfig ? shapeConfig.traceIcon : shapeKey;

        const slotWrapper = document.createElement("div");
        slotWrapper.style.display = "flex";
        slotWrapper.style.flexDirection = "column";
        slotWrapper.style.alignItems = "center";
        slotWrapper.style.gap = "8px";

        const hudSlot = document.createElement("div");
        hudSlot.className = "hud-slot voxel-slot";
        hudSlot.id = `hud-${shapeKey.toLowerCase()}`;

        const needle = document.createElement("div");
        needle.className = "hud-needle";
        
        const iconEl = document.createElement("div");
        iconEl.className = "hud-spell-icon";
        iconEl.style.position = "absolute";
        iconEl.style.width = "100%";
        iconEl.style.height = "100%";
        iconEl.style.display = "flex";
        iconEl.style.justifyContent = "center";
        iconEl.style.alignItems = "center";
        iconEl.style.zIndex = "2";

        if (spell.icon.endsWith('.png')) {
            iconEl.innerHTML = `<img src="${spell.icon}" style="width:70%; height:70%; object-fit:contain;">`;
        } else {
            iconEl.innerHTML = `<span style="font-size:32px">${spell.icon}</span>`;
        }

        hudSlot.appendChild(needle);
        hudSlot.appendChild(iconEl);
        
        hudSlot.style.color = window.ElementDatabase?.[spell.element]?.color || "#fff";

        const traceImg = document.createElement("img");
        traceImg.src = `assets/symbols/${traceIcon}`;
        traceImg.style.width = "32px";
        traceImg.style.height = "32px";
        traceImg.style.objectFit = "contain";
        traceImg.style.filter = "brightness(0) invert(1) drop-shadow(0 0 4px rgba(255,255,255,0.8))";

        slotWrapper.appendChild(hudSlot);
        slotWrapper.appendChild(traceImg);

        hudSpellsContainer.appendChild(slotWrapper);
      });
    };
  }

  _setupDOMForHub() {
    // Afficher / cacher les éléments HTML appropriés pour le Hub
    document.getElementById("uiContainer").classList.add("hidden"); // Pas de HP/XP bar
    document.getElementById("hudSpells").classList.remove("hidden"); // Barre de sorts visible
    document.getElementById("hudScoreTimer")?.classList.add("hidden"); // Pas de score/timer
    document.getElementById("characterSelectionScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("levelUpScreen").classList.add("hidden");
    document.getElementById("handLostOverlay").classList.add("hidden");
  }

  _setupGlobals() {
    window.isGamePaused = false;
    // Pas de cast de sort dans le hub
    window.onShapeDetected = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOUCLE DE MISE À JOUR (appelée par SceneManager chaque frame)
  // ─────────────────────────────────────────────────────────────────────────
  update() {
    if (this._disposed) return;

    const now = performance.now();
    const dt = now - this._lastRealTime;
    this._lastRealTime = now;
    this.gameTime += dt;
    window.gameTime = this.gameTime;

    const ePressed = this.inputManager.isCharPressed('e');
    const eJustPressed = ePressed && !this._ePressedLastFrame;

    // Sélection de personnage en cours → seulement le carousel
    if (this.inCharacterSelection) {
      this._handleCarouselInput();
      return;
    }

    // Menu des sorts ouvert
    if (this.inLoadoutMenu) {
      if (eJustPressed) {
          this.loadoutUI.hide();
          this.inLoadoutMenu = false;
          const promptEl = document.getElementById("interactionPrompt");
          if (promptEl) promptEl.classList.remove("hidden");
      }
      this._ePressedLastFrame = ePressed;
      return; // Bloque les mouvements
    }

    // Mouvement joueur + caméra
    this.player.update(this.inputManager, []);
    this.cameraManager.update();

    // Animation du livre et du miroir
    if (this.bookMesh) {
      this.bookMesh.rotation.y += 0.01;
    }
    if (this.characterAltar) {
      this.characterAltar.rotation.y -= 0.01; // Tourne dans le sens inverse
    }

    // ── Détection de proximité : Portail → Level ──
    const distPortal = BABYLON.Vector3.Distance(
      this.player.mesh.position,
      this.portal.position,
    );
    
    const promptEl = document.getElementById("interactionPrompt");
    let promptVisible = false;
    
    if (distPortal < 3 && this.onEnterPortal) {
      promptVisible = true;
      promptEl.innerText = "PRESS [E] TO ENTER LEVEL";
      
      if (eJustPressed) {
        // Validation: Le joueur doit avoir au moins un sort d'équipé
        const loadout = window.loadoutManager ? window.loadoutManager.getLoadout() : { bindings: {} };
        const hasSpells = Object.values(loadout.bindings).some(s => s != null);
        if (!hasSpells) {
            document.getElementById('errorModalMessage').innerText = "You must equip at least one spell before entering the portal!";
            document.getElementById('errorModal').classList.remove('hidden');
            return;
        }

        promptEl.classList.add("hidden");
        this.onEnterPortal();
        return; // Évite les appels multiples cette frame
      }
    }
    
    // ── Détection de proximité : Autel Sorts → LoadoutUI ──
    const distAltar = BABYLON.Vector3.Distance(
      this.player.mesh.position,
      this.spellAltar.position,
    );
    
    if (distAltar < 4 && distPortal >= 3) {
      promptVisible = true;
      promptEl.innerText = "PRESS [E] TO CHOOSE SPELLS";
      
      if (eJustPressed) {
          if (this.loadoutUI.domElements.screen.classList.contains("hidden")) {
              this.loadoutUI.show();
              this.inLoadoutMenu = true;
          } else {
              this.loadoutUI.hide();
              this.inLoadoutMenu = false;
          }
      }

      // Hide the prompt if the menu is actually open
      if (!this.loadoutUI.domElements.screen.classList.contains("hidden")) {
          promptVisible = false;
      }
    } else {
      if (!this.loadoutUI.domElements.screen.classList.contains("hidden")) {
        this.loadoutUI.hide();
      }
    }

    // ── Détection de proximité : Autel Personnages → Carrousel ──
    const distChar = BABYLON.Vector3.Distance(
      this.player.mesh.position,
      this.characterAltar.position,
    );
    
    if (distChar < 3 && distAltar >= 4 && distPortal >= 3) {
      promptVisible = true;
      promptEl.innerText = "PRESS [E] TO CHOOSE YOUR CHARACTER";
      
      if (eJustPressed) {
        this._enterCharacterSelection();
        promptVisible = false;
      }
    }
    
    // Apply visibility and store key state
    if (promptVisible) {
        promptEl.classList.remove("hidden");
    } else {
        promptEl.classList.add("hidden");
    }
    this._ePressedLastFrame = ePressed;

    // HUD cooldowns (toujours visibles en Hub pour feedback)
    this._updateCooldownHUD();
  }

  _enterCharacterSelection() {
    this.inCharacterSelection = true;

    this.loadoutUI.hide();
    document.getElementById("hudSpells").classList.add("hidden");
    this.portal.setEnabled(false);
    this.spellAltar.setEnabled(false);
    this.characterAltar.setEnabled(false);

    // Cacher le joueur actuel du hub
    if (this.player && this.player.mesh) {
      this.player.mesh.setEnabled(false);
    }

    // Caméra face aux personnages
    const cam = this.scene.activeCamera;
    cam.lockedTarget = null;
    cam.position = new BABYLON.Vector3(0, 2.5, 12);
    cam.setTarget(new BABYLON.Vector3(0, 2.5, 4));

    this.carouselManager.setVisible(true);
    document
      .getElementById("characterSelectionScreen")
      .classList.remove("hidden");

    // Déplacer le joueur hors champ
    this.player.mesh.position.copyFrom(new BABYLON.Vector3(-10, 0, 0));
  }

  _handleCarouselInput() {
    if (
      this.inputManager.isKeyPressed("ArrowLeft") ||
      this.inputManager.isKeyPressed("KeyA")
    ) {
      if (!this.carouselManager._leftPressed) {
        this.carouselManager.rotateCarousel(-1);
        this.carouselManager._leftPressed = true;
      }
    } else {
      this.carouselManager._leftPressed = false;
    }

    if (
      this.inputManager.isKeyPressed("ArrowRight") ||
      this.inputManager.isKeyPressed("KeyD")
    ) {
      if (!this.carouselManager._rightPressed) {
        this.carouselManager.rotateCarousel(1);
        this.carouselManager._rightPressed = true;
      }
    } else {
      this.carouselManager._rightPressed = false;
    }
  }

  _updateCooldownHUD() {
    if (!window.loadoutManager) return;
    const loadout = window.loadoutManager.getLoadout();
    ["CERCLE", "LIGNE", "TRIANGLE"].forEach((shape) => {
      const spell = loadout.bindings[shape];
      if (!spell) return;
      const cooldownMs = spell.cooldown * 1000;
      const lastTime =
        (window.spellCooldowns && window.spellCooldowns[spell.id]) || -999999;
      
      // Dans le hub, les sorts sont désactivés donc on met les compteurs à 0
      const angle = 0;
      const hudSlot = document.getElementById(`hud-${shape.toLowerCase()}`);
      const needle = hudSlot ? hudSlot.querySelector(".hud-needle") : null;
      if (needle) needle.style.transform = `rotate(${angle}deg)`;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DISPOSE
  // ─────────────────────────────────────────────────────────────────────────
  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.loadoutUI?.hide();

    this.scene.onBeforeRenderObservable.removeCallback(this._renderObserver);
    this._renderObserver = null;
    
    if (this.pauseManager) {
      this.pauseManager.dispose();
      this.pauseManager = null;
    }

    this.scene.dispose();
    console.log("[HubScene] Disposée.");
  }
}
