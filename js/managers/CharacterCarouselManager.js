export class CharacterCarouselManager {
  constructor(scene, uiElements, playCallback) {
    this.scene = scene;

    // Configuration
    this.radius = 4; // Rayon du cercle
    this.characters = []; // Les objets de persos { name, mesh, stats, unlocked, unlockCondition }
    this.currentIndex = 0;
    this.isAnimating = false;

    // Pointeur vers la méthode pour changer de perso dans main.js
    this.onPlay = playCallback;

    // UI references
    this.ui = uiElements;

    // Créer un centre invisible pour faire tourner le tout
    this.carouselPivot = new BABYLON.TransformNode("carouselPivot", scene);
    // Placer le pivot un peu devant et en bas pour l'effet de base
    this.carouselPivot.position = new BABYLON.Vector3(0, 0, 0);

    // Matériaux de base
    this.lockedMaterial = new BABYLON.StandardMaterial("lockedMat", scene);
    this.lockedMaterial.disableLighting = true;
    this.lockedMaterial.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.2); // Gris bleuté visible
    this.lockedMaterial.alpha = 0.8;

    this.bindEvents();
  }

  // charactersData: array of {name, title, class, modelName, unlocked, unlockCondition, stats: {force: %, vitesse: %, magie: %}}
  initCharacters(charactersData, templates) {
    let angleStep = (Math.PI * 2) / charactersData.length;

    charactersData.forEach((data, index) => {
      const angle = index * angleStep;

      // Créer un wrapper pour ne pas toucher aux transformations internes du GLB
      const wrapper = new BABYLON.TransformNode(
        `wrapper_${data.name}`,
        this.scene,
      );
      wrapper.parent = this.carouselPivot;
      wrapper.position.x = Math.sin(angle) * this.radius;
      wrapper.position.z = Math.cos(angle) * this.radius;
      wrapper.position.y = 0; // Au niveau du sol

      // Instancier le modèle
      let visualMesh;
        if (templates[data.modelName]) {
        let tpl = templates[data.modelName];
        console.log(`[CAROUSEL] Loading model: ${data.name}`);
        
        if (tpl.idleContainer) {
            let inst = tpl.idleContainer.instantiateModelsToScene(name => name + "_carousel_" + data.name, true);
            visualMesh = inst.rootNodes[0];
            visualMesh.parent = wrapper;
            visualMesh.scaling = new BABYLON.Vector3(4, 4, 4);
            visualMesh.position = new BABYLON.Vector3(0, 0.21, 0); // Origin at feet
            // Jouer l'animation en boucle
            if (inst.animationGroups && inst.animationGroups.length > 0) {
                inst.animationGroups.forEach(ag => ag.play(true));
            }
        } else {
            visualMesh = tpl.mesh.clone(`char_${data.name}`, wrapper);
            visualMesh.scaling = new BABYLON.Vector3(4, 4, 4);
            visualMesh.position = new BABYLON.Vector3(0, 2.1, 0); // Origin at center
            
            // Les modèles par défaut (sans idleContainer) sont exportés tournés sur le côté. 
            // On les tourne pour qu'ils fassent face à la caméra.
            visualMesh.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
        }

        // Forcer l'activation récursive
        visualMesh.setEnabled(true);
        visualMesh.isVisible = true;
        visualMesh.getChildMeshes().forEach((m) => {
          m.setEnabled(true);
          m.isVisible = true;
        });
      } else {
        console.warn(
          `[CAROUSEL] Template not found for ${data.modelName}, using fallback box`,
        );
        visualMesh = BABYLON.MeshBuilder.CreateBox(
          `char_${data.name}`,
          { height: 2 },
          this.scene,
        );
        visualMesh.parent = wrapper;
        visualMesh.position.y = 1;
      }

      // Tourner le WRAPPER
      wrapper.lookAt(new BABYLON.Vector3(0, 0, 0));
      // Pas de rotation supplémentaire : 0 = face à la caméra
      wrapper.rotate(
        BABYLON.Axis.Y,
        0,
        BABYLON.Space.LOCAL,
      );

      // SOCLE (Cylindre Pierre)
      const base = BABYLON.MeshBuilder.CreateCylinder(
        `base_${data.name}`,
        { diameter: 2.2, height: 0.2 },
        this.scene,
      );
      base.parent = wrapper;
      base.position.y = 0.1; // Socle posé sur le sol y=0
      const baseMat = new BABYLON.StandardMaterial(
        `baseMat_${data.name}`,
        this.scene,
      );
      baseMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      base.material = baseMat;

      if (!data.unlocked) {
        visualMesh.getChildMeshes().forEach((m) => {
          m.material = this.lockedMaterial;
        });
      }

      this.characters.push({
        ...data,
        mesh: wrapper,
        visualMesh: visualMesh,
        baseAngle: angle,
      });
    });

    // Lumière Ambiante locale pour le carrousel
    this.carouselLight = new BABYLON.HemisphericLight(
      "carouselLight",
      new BABYLON.Vector3(0, 1, 1),
      this.scene,
    );
    this.carouselLight.intensity = 1.2;
    this.carouselLight.parent = this.carouselPivot;

    this.updateVisuals();
    this.updateUI();
  }

  bindEvents() {
    // Supprimer les anciens event listeners en créant des clones
    // Cela évite l'accumulation si init est rappelé plusieurs fois.
    const newBtnPrev = this.ui.btnPrev.cloneNode(true);
    this.ui.btnPrev.parentNode.replaceChild(newBtnPrev, this.ui.btnPrev);
    this.ui.btnPrev = newBtnPrev;

    const newBtnNext = this.ui.btnNext.cloneNode(true);
    this.ui.btnNext.parentNode.replaceChild(newBtnNext, this.ui.btnNext);
    this.ui.btnNext = newBtnNext;

    const newBtnPlay = this.ui.btnPlay.cloneNode(true);
    this.ui.btnPlay.parentNode.replaceChild(newBtnPlay, this.ui.btnPlay);
    this.ui.btnPlay = newBtnPlay;

    // Ré-attachement des évènements sur les nouveaux clones
    this.ui.btnPrev.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[CAROUSEL] Prev clicked");
      this.rotateCarousel(1);
    });
    this.ui.btnNext.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[CAROUSEL] Next clicked");
      this.rotateCarousel(-1);
    });

    this.ui.btnPlay.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("[CAROUSEL] Play clicked");
      const currentChar = this.characters[this.currentIndex];
      if (currentChar && currentChar.unlocked) {
        this.playSelectedCharacter();
      }
    });
  }

  rotateCarousel(direction) {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this.currentIndex += direction;

    // Wrap around
    if (this.currentIndex < 0) this.currentIndex = this.characters.length - 1;
    if (this.currentIndex >= this.characters.length) this.currentIndex = 0;

    const targetRotY =
      -this.currentIndex * ((Math.PI * 2) / this.characters.length);

    // Trouver la rotation la plus courte pour l'animation
    let currentRotY = this.carouselPivot.rotation.y;

    // Normaliser l'angle entre -PI et PI pour tourner dans le bon sens
    let diff = (targetRotY - currentRotY) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;

    let finalTargetRotY = currentRotY + diff;

    // Animation de rotation (Ease-Out, durée ~0.4s = 24 frames @ 60fps)
    const frameRate = 60;
    const rotateAnim = new BABYLON.Animation(
      "rotateCarousel",
      "rotation.y",
      frameRate,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
    );

    const keys = [
      { frame: 0, value: currentRotY },
      { frame: 24, value: finalTargetRotY },
    ];

    // Courbe d'easing
    const easingFunction = new BABYLON.SineEase();
    easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
    rotateAnim.setEasingFunction(easingFunction);

    rotateAnim.setKeys(keys);
    this.carouselPivot.animations = [];
    this.carouselPivot.animations.push(rotateAnim);

    this.scene.beginAnimation(this.carouselPivot, 0, 24, false, 1, () => {
      this.carouselPivot.rotation.y = targetRotY; // Force exact target
      this.isAnimating = false;
    });

    this.updateVisuals();
    this.updateUI();
  }

  updateVisuals() {
    this.characters.forEach((char, index) => {
      // Est-ce le perso central ?
      const isCenter = index === this.currentIndex;

      // Animation d'échelle
      const targetScale = isCenter ? 1.0 : 0.7;
      const scaleAnim = new BABYLON.Animation(
        "scaleChar",
        "scaling",
        60,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      );
      scaleAnim.setKeys([
        { frame: 0, value: char.mesh.scaling },
        {
          frame: 24,
          value: new BABYLON.Vector3(targetScale, targetScale, targetScale),
        },
      ]);

      // Lancer l'animation
      this.scene.beginDirectAnimation(char.mesh, [scaleAnim], 0, 24, false);

      // Gestion de la luminosité pour les persos débloqués
      if (char.unlocked && char.visualMesh) {
        // Les meshes enfants (si GLB, souvent des sub-meshes)
        char.visualMesh.getChildMeshes(false).forEach((m) => {
          if (m.material && !m.material.disableLighting) {
            // Ne pas toucher au materiau "Lock"
            // Pour StandardMaterial, jouer avec de l'emissive ou modifier l'emissiveColor
            if (m.material instanceof BABYLON.PBRMaterial) {
              m.material.emissiveIntensity = isCenter ? 1.0 : 0.2;
            } else if (m.material instanceof BABYLON.StandardMaterial) {
              // Approximation en StandardMaterial
              const brightness = isCenter ? 0.3 : 0.0;
              m.material.emissiveColor = new BABYLON.Color3(
                brightness,
                brightness,
                brightness,
              );
            }
          }
        });
      }
    });
  }

  updateUI() {
    const currentChar = this.characters[this.currentIndex];

    // Textes
    this.ui.charName.innerText = currentChar.name.toUpperCase();
    this.ui.charClass.innerText = currentChar.className;

    // Bonus Text UI
    if (this.ui.charBonusText) {
        this.ui.charBonusText.innerText = currentChar.bonusText || "";
    }

    // Gérer le lock state
    if (currentChar.unlocked) {
      this.ui.lockBanner.classList.add("hidden");
      this.ui.btnPlay.disabled = false;
      this.ui.btnPlay.innerText = "CHOISIR";
      this.ui.btnPlay.classList.add("pulse-glow");
      this.ui.btnPlay.style.background = "#7b00ff";
    } else {
      this.ui.lockBanner.classList.remove("hidden");
      this.ui.lockCondition.innerText = currentChar.unlockCondition;
      this.ui.btnPlay.disabled = true;
      this.ui.btnPlay.innerText = "VERROUILLÉ";
      this.ui.btnPlay.classList.remove("pulse-glow");
      this.ui.btnPlay.style.background = "#444";
    }
  }

  playSelectedCharacter() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    const currentChar = this.characters[this.currentIndex];

    // 1. Dolly Zoom (Zoom in de la caméra vers le perso)
    // Obtenir la vraie caméra (doit être configurée par main.js)
    const camera = this.scene.activeCamera;

    // Mémoriser le fov initial
    const initialFov = camera.fov;
    const targetFov = initialFov / 3;

    // Animer le FOV
    const fovAnim = new BABYLON.Animation(
      "dollyFov",
      "fov",
      60,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    fovAnim.setKeys([
      { frame: 0, value: initialFov },
      { frame: 30, value: targetFov },
    ]);

    // Easing pour le zoom
    const easingFunction = new BABYLON.CubicEase();
    easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    fovAnim.setEasingFunction(easingFunction);

    camera.animations = [fovAnim];

    // Fondu au noir HTML
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "black";
    overlay.style.zIndex = "9999";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease-in";
    document.body.appendChild(overlay);

    this.scene.beginAnimation(camera, 0, 30, false, 1, () => {
      // Déclencher le fondu la frame après pour synchro
      overlay.style.opacity = "1";

      // Attendre le fondu puis déclencher le callback
      setTimeout(() => {
        // Rétablir le FOV discrètement
        camera.fov = initialFov;

        // Exécuter l'action principale (Changement de state / Perso)
        this.onPlay(currentChar);
        
        // Sauvegarder la progression avec le nouveau perso choisi
        if (window.saveGameData) {
            window.saveGameData(currentChar.modelName);
        }

        // Enlever le overlay de fondu
        overlay.style.transition = "opacity 0.5s ease-out";
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 500);

        this.isAnimating = false;
      }, 600);
    });
  }

  setVisible(visible) {
    this.carouselPivot.setEnabled(visible);
    if (this.carouselLight) this.carouselLight.setEnabled(visible);
    if (visible) {
      // reset rotation ou mise à jour UI
      this.updateUI();
      this.updateVisuals();
    }
  }
}
