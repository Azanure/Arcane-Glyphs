import { LakeGenerator } from "../math/LakeGenerator.js";
import { assetLibrary } from "./AssetLibrary.js";

export const CHUNK_SIZE = 16;
export const TILE_SIZE = 2;

// Cache pour les textures de debug afin de ne pas saturer la RAM
let soilTexture = null;
let lavaTexture = null;
let soilMaterial = null;
let lavaMaterial = null;
let pitMaterial = null;
let bordMaterial = null;

function getSharedResources(scene, type) {
  if (type === 1 && soilMaterial) return soilMaterial;
  if (type === 0 && lavaMaterial) return lavaMaterial;
  if (type === 2 && pitMaterial) return pitMaterial;
  if (type === 3 && bordMaterial) return bordMaterial;

  const tex = new BABYLON.DynamicTexture(
    `tex_${type}`,
    { width: 128, height: 128 },
    scene,
  );
  const ctx = tex.getContext();
  if (type === 2) ctx.fillStyle = "blue";
  else if (type === 3) ctx.fillStyle = "orange";
  else ctx.fillStyle = "red"; // Rouge pour la lave
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "white";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";

  let label = "LAVA";
  if (type === 1) label = "SOIL";
  if (type === 2) label = "TROU";
  if (type === 3) label = "BORD";

  ctx.fillText(label, 64, 70);
  tex.update();

  const mat = new BABYLON.StandardMaterial(`mat_debug_${type}`, scene);
  mat.diffuseTexture = tex;
  mat.specularColor = new BABYLON.Color3(0, 0, 0);

  if (type === 1) {
    soilTexture = tex;
    soilMaterial = mat;
  } else if (type === 0) {
    lavaTexture = tex;
    lavaMaterial = mat;
  } else if (type === 2) {
    pitMaterial = mat;
  } else {
    bordMaterial = mat;
  }
  return mat;
}

export class TerrainChunk {
  constructor(chunkX, chunkZ, noiseGen, pitGen, scene) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.noiseGen = noiseGen;
    this.pitGen = pitGen;
    this.scene = scene;
    this.instances = [];

    // Noeud racine du chunk pour regrouper les meshes
    this.rootNode = new BABYLON.TransformNode(
      `chunk_${chunkX}_${chunkZ}`,
      scene,
    );
    this.rootNode.position.x = chunkX * CHUNK_SIZE * TILE_SIZE;
    this.rootNode.position.z = chunkZ * CHUNK_SIZE * TILE_SIZE;

    this.generate();
  }

  // Renvoie 0 (Lave), 1 (Sol), 2 (Trou) ou 3 (Bord)
  getNoiseAt(x, z) {
    // 1. PRIORITÉ ABSOLUE : La lave
    if (this.noiseGen.isLava(x, z)) return 0;

    // 2. TROUS : On vérifie si c'est un trou valide
    let isHole = false;
    if (this.pitGen.isPit(x, z)) {
      // RÈGLE : Au moins 1 case entre lave et trou (y compris en diagonale)
      const nearLava =
        this.noiseGen.isLava(x + 1, z) ||
        this.noiseGen.isLava(x - 1, z) ||
        this.noiseGen.isLava(x, z + 1) ||
        this.noiseGen.isLava(x, z - 1) ||
        this.noiseGen.isLava(x + 1, z + 1) ||
        this.noiseGen.isLava(x - 1, z - 1) ||
        this.noiseGen.isLava(x + 1, z - 1) ||
        this.noiseGen.isLava(x - 1, z + 1);

      if (!nearLava) {
        isHole = true;
      }
    }

    if (isHole) return 2;

    // 3. BORDS : Si on n'est pas un trou (ou si c'est un trou annulé), on regarde s'il y a un trou valide à côté
    if (
      this.isPitValidated(x + 1, z) ||
      this.isPitValidated(x - 1, z) ||
      this.isPitValidated(x, z + 1) ||
      this.isPitValidated(x, z - 1)
    ) {
      return 3;
    }

    return 1; // Sol par défaut
  }

  // Helper pour savoir si une case est un "vrai" trou (pas annulé par la lave)
  isPitValidated(x, z) {
    if (!this.pitGen.isPit(x, z)) return false;
    if (
      this.noiseGen.isLava(x + 1, z) ||
      this.noiseGen.isLava(x - 1, z) ||
      this.noiseGen.isLava(x, z + 1) ||
      this.noiseGen.isLava(x, z - 1) ||
      this.noiseGen.isLava(x + 1, z + 1) ||
      this.noiseGen.isLava(x - 1, z - 1) ||
      this.noiseGen.isLava(x + 1, z - 1) ||
      this.noiseGen.isLava(x - 1, z + 1)
    ) {
      return false;
    }
    return true;
  }

  generate() {
    const startX = this.chunkX * CHUNK_SIZE;
    const startZ = this.chunkZ * CHUNK_SIZE;

    // On ne crée plus soilMesh ni bordMesh car on utilise des instances individuelles
    const lavaMesh = BABYLON.MeshBuilder.CreateBox(
      "chunk_lava_" + this.chunkX + "_" + this.chunkZ,
      { width: TILE_SIZE, height: 0.1, depth: TILE_SIZE },
      this.scene,
    );

    lavaMesh.parent = this.rootNode;
    lavaMesh.position.y = -0.05;
    lavaMesh.material = getSharedResources(this.scene, 0);

    const lavaMatrices = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let worldX = startX + x;
        let worldZ = startZ + z;
        let type = this.getNoiseAt(worldX, worldZ);

        // --- DÉTECTION CENTRE OU COIN DE LAVE ---
        let isLavaCenter = false;
        let isLavaCorner = false;
        let cornerRotation = 0;

        if (type === 0) {
          const top = this.getNoiseAt(worldX, worldZ + 1) === 0;
          const bottom = this.getNoiseAt(worldX, worldZ - 1) === 0;
          const left = this.getNoiseAt(worldX - 1, worldZ) === 0;
          const right = this.getNoiseAt(worldX + 1, worldZ) === 0;

          // BITMASK : T=1, R=2, B=4, L=8
          let mask = 0;
          if (top) mask |= 1;
          if (right) mask |= 2;
          if (bottom) mask |= 4;
          if (left) mask |= 8;
          const lavaCount =
            (top ? 1 : 0) + (right ? 1 : 0) + (bottom ? 1 : 0) + (left ? 1 : 0);

          let visualName = null;
          let collisionName = null;
          let rotY = 0;
          let variant = "A";

          if (lavaCount === 4) {
            visualName = "lava_pit";
            collisionName = "lava_pit_lava";
          } else if (lavaCount === 3) {
            // BORD DROIT (3 voisins lave, 1 voisin sol)
            variant = this.noiseGen.hash(worldX, worldZ) % 2 === 0 ? "A" : "B";
            visualName = `lava_pit_middle_${variant}`;

            // NOTE : Dans le fichier GLB source, les noms '.lava' et '.soil' sont inversés
            // pour les modèles 'middle'. On utilise donc '.soil' pour récupérer la collision de la lave.
            collisionName = `lava_pit_middle_${variant}.lava`;

            // DEBUG/CALIBRATION : Rotation 0 pour identifier l'orientation native
            if (mask === 14)
              rotY = (3 * Math.PI) / 2; // Sol en Haut (+Z) (mask 14 = R+B+L)
            else if (mask === 13)
              rotY = 0; // Sol à Droite (+X) (mask 13 = B+G+H)
            else if (mask === 11)
              rotY = Math.PI / 2; // Sol en Bas (-Z) (mask 11 = G+H+D)
            else if (mask === 7) rotY = Math.PI; // Sol à Gauche (-X) (mask 7 = H+D+B)
          } else if (lavaCount === 2 && mask !== 5 && mask !== 10) {
            // COIN (2 voisins adjacents)
            variant = this.noiseGen.hash(worldX, worldZ) % 2 === 0 ? "A" : "B";
            visualName = `lava_pit_inner_corner_${variant}`;
            collisionName = `lava_pit_inner_corner_${variant}_lava`;

            // MAPPING CALIBRÉ : A (Top-Right par défaut), B (Bottom-Left par défaut)
            if (variant === "A") {
              if (mask === 3)
                rotY = Math.PI / 2; // Lave en Haut+Droite
              else if (mask === 6)
                rotY = Math.PI; // Lave en Droite+Bas
              else if (mask === 12)
                rotY = (3 * Math.PI) / 2; // Lave en Bas+Gauche
              else if (mask === 9) rotY = 0; // Lave en Gauche+Haut
            } else {
              // Variante B est l'inverse de A (décalage 180°)
              if (mask === 12)
                rotY = (3 * Math.PI) / 2; // Lave en Bas+Gauche
              else if (mask === 9)
                rotY = 0; // Lave en Gauche+Haut
              else if (mask === 3)
                rotY = Math.PI / 2; // Lave en Haut+Droite
              else if (mask === 6) rotY = Math.PI; // Lave en Droite+Bas
            }
          }

          if (visualName) {
            const visual = assetLibrary.createInstance(
              visualName,
              `lava_vis_${worldX}_${worldZ}`,
            );
            const sourceLava = assetLibrary.meshes.get(collisionName);
            const collision = sourceLava
              ? assetLibrary.createInstance(collisionName, `lava_col_${worldX}_${worldZ}`)
              : null;

            if (visual && collision) {
              const xPos = x * TILE_SIZE + TILE_SIZE / 2;
              const zPos = z * TILE_SIZE + TILE_SIZE / 2;

              [visual, collision].forEach((inst) => {
                inst.setEnabled(true);
                inst.parent = this.rootNode;
                inst.position.set(0, 0, 0);
                inst.isWalkableEnvironment = true;

                // On RAZ le Quaternion car sinon .rotation est ignoré
                inst.rotationQuaternion = null;
                inst.position.set(xPos, 0, zPos);
                inst.rotation.y += rotY; // On AJOUTE la rotation au lieu de l'écraser

                // Correctif spécifique : décalage de PI UNIQUEMENT pour la collision du COIN B
                if (
                  inst === collision &&
                  variant === "B" &&
                  visualName.includes("inner_corner")
                ) {
                  inst.rotation.y += Math.PI;
                }
                if (inst === collision && visualName.includes("middle")) {
                  inst.rotation.y += Math.PI;
                }

                this.instances.push(inst);
              });

              // Rendre la collision invisible mais toujours détectable par le raycast
              collision.isVisible = false;
              collision.isPickable = true;
              collision.checkCollisions = false;

              collision.getChildMeshes().forEach((m) => {
                m.isVisible = false;
                m.isPickable = true;
                m.checkCollisions = false;
              });
            }
          } else {
            // Lave générique (petites plaques ou couloirs)
            const xPos = x * TILE_SIZE + TILE_SIZE / 2;
            const zPos = z * TILE_SIZE + TILE_SIZE / 2;
            const matrix = BABYLON.Matrix.Translation(xPos, 0, zPos);
            lavaMatrices.push(...matrix.asArray());
          }
        } else if (type === 1) {
          // SOL : visuel + isPickable pour que le Raycast sol du joueur le détecte
          const xPos = x * TILE_SIZE + TILE_SIZE / 2;
          const zPos = z * TILE_SIZE + TILE_SIZE / 2;

          let hash = Math.abs(this.noiseGen.hash(worldX, worldZ));
          let visualName = "soil_clean_A";
          if (hash % 100 >= 80) {
            const others = [
              "ruin_A",
              "ruin_B",
              "ruin_C",
              "ruin_D",
              "ruin_E",
              "crack_A",
              "crack_B",
              "crack_C",
            ];
            visualName = others[hash % others.length];
          }

          const source = assetLibrary.meshes.get(visualName);
          if (source) {
            const visual = assetLibrary.createInstance(visualName, `soil_vis_${worldX}_${worldZ}`);
            if (!visual) continue;
            visual.parent = this.rootNode;
            visual.position.set(xPos, 0, zPos);
            visual.rotationQuaternion = null;
            visual.isWalkableEnvironment = true;

            // Utilisation de bits différents pour la rotation pour éviter la corrélation avec le type de tuile !
            visual.rotation.y = (Math.floor(hash / 8) % 4) * (Math.PI / 2);

            // isPickable=true : le Raycast sol du joueur peut le toucher
            // checkCollisions=false : pas de collision moteur (on utilise le Raycast)
            visual.isPickable = true;
            visual.checkCollisions = false;
            visual.getChildMeshes().forEach((m) => {
              m.isPickable = true;
              m.checkCollisions = false;
            });
            visual.setEnabled(true);
            visual.isVisible = true;
            this.instances.push(visual);
          }

          // --- SPAWN DECORATIONS (Rocks, Rubble) ---
          const absHash = Math.abs(hash);
          if (absHash % 100 < 5) {
            // 5% de chance de spawn par tuile (baissé)
            let decoCount = (absHash % 3) + 1; // 1 à 3 objets
            const decoPool = [
              "rocks_A",
              "rocks_B",
              "rocks_C",
              "rocks_D",
              "rocks_E",
              "rocks_F",
              "rocks_G",
              "rubble_A",
              "rubble_B",
              "burned_tree_A",
              "burned_tree_B",
              "burned_tree_C",
            ];

            // 4 slots mieux espacés (un par quadrant de la tuile 2x2)
            const slots = [
              { x: -0.45, z: 0.45 },
              { x: 0.45, z: 0.45 },
              { x: -0.45, z: -0.45 },
              { x: 0.45, z: -0.45 },
            ];

            // Mélange déterministe des slots
            for (let j = slots.length - 1; j > 0; j--) {
              const k = (absHash + j) % (j + 1);
              [slots[j], slots[k]] = [slots[k], slots[j]];
            }

            for (let i = 0; i < decoCount; i++) {
              const subHash = Math.abs(
                this.noiseGen.hash(worldX + i * 100, worldZ + i * 100),
              );
              const decoName = decoPool[subHash % decoPool.length];

              // LOGIQUE ANTI-OVERLAP : Si c'est un ARBRE, on le met SEUL sur la case.
              // On réduit decoCount à 1 si le premier objet tiré est un arbre.
              if (decoName.includes("tree")) {
                decoCount = 1;
              }

              const deco = assetLibrary.createInstance(
                decoName,
                `deco_${decoName}_${worldX}_${worldZ}_${i}`,
              );

              if (deco) {
                deco.parent = this.rootNode;

                // On utilise le slot i
                const offsetX = slots[i].x;
                const offsetZ = slots[i].z;

                const hY =
                  typeof window.debugDecoPosY !== "undefined" &&
                  decoName.includes("tree")
                    ? window.debugDecoPosY
                    : 1.0;
                deco.position.set(xPos + offsetX, hY, zPos + offsetZ);

                if (window.debugDecoEuler && decoName.includes("tree")) {
                  deco.rotationQuaternion = null; // Force Euler
                  deco.rotation.set(
                    window.debugDecoEuler.x,
                    window.debugDecoEuler.y,
                    window.debugDecoEuler.z,
                  );
                } else {
                  deco.rotationQuaternion = null; // Force Euler
                  const randY = ((subHash % 360) * Math.PI) / 180;
                  const randZ = (((subHash >> 4) % 360) * Math.PI) / 180;

                  let rotX = 0;
                  let rotZ = 0;

                  if (decoName.includes("rocks")) {
                    rotX = Math.PI / 2; // 90 deg
                    rotZ = randZ;
                  } else if (decoName.includes("tree")) {
                    rotX = 0; // À ajuster avec le debug
                    rotZ = 0;
                  }
                  // Pour rubble, rotX=0 et rotZ=0 par défaut

                  deco.rotation.set(rotX, randY, rotZ);
                }
                // deco.rotation.y = (subHash % 4) * (Math.PI / 2);
                const isRubble = decoName.includes("rubble");
                if (!isRubble) {
                  deco.scaling.setAll(2);
                }
                deco.isObstacleEnvironment = !isRubble;
                deco.isPickable = true; // Toujours pickable pour monter dessus
                deco.checkCollisions = false;
                deco.getChildMeshes().forEach((m) => {
                  m.isPickable = true;
                  m.checkCollisions = false;
                  m.isVisible = true;
                });
                deco.setEnabled(true);
                deco.isVisible = true;
                this.instances.push(deco);
              }
            }
          }
        } else if (type === 3) {
          // BORD (autour d'un trou) : visuel isPickable + murs invisibles sur les côtés face au vide
          const top = this.getNoiseAt(worldX, worldZ + 1) === 2;
          const bottom = this.getNoiseAt(worldX, worldZ - 1) === 2;
          const left = this.getNoiseAt(worldX - 1, worldZ) === 2;
          const right = this.getNoiseAt(worldX + 1, worldZ) === 2;

          let pitCount =
            (top ? 1 : 0) + (bottom ? 1 : 0) + (left ? 1 : 0) + (right ? 1 : 0);
          let mask =
            (top ? 1 : 0) + (right ? 2 : 0) + (bottom ? 4 : 0) + (left ? 8 : 0);

          let visualName = "";
          let rotY = 0;
          let hash = this.noiseGen.hash(worldX, worldZ);

          if (pitCount === 1) {
            const variants = ["middle_A", "middle_B", "middle_C"];
            visualName = variants[hash % 3];
            if (mask === 1) rotY = Math.PI;
            else if (mask === 2) rotY = (3 * Math.PI) / 2;
            else if (mask === 4) rotY = 0;
            else if (mask === 8) rotY = Math.PI / 2;
          } else if (pitCount === 2) {
            const variants = ["corner_A", "corner_B", "inner_A"];
            visualName = variants[hash % 3];
            if (mask === 3) rotY = Math.PI;
            else if (mask === 6) rotY = (3 * Math.PI) / 2;
            else if (mask === 12) rotY = 0;
            else if (mask === 9) rotY = Math.PI / 2;
          }

          const xPos = x * TILE_SIZE + TILE_SIZE / 2;
          const zPos = z * TILE_SIZE + TILE_SIZE / 2;
          const halfTile = TILE_SIZE / 2;

          if (visualName) {
            const source = assetLibrary.meshes.get(visualName);
            if (source) {
              const visual = assetLibrary.createInstance(visualName, `bord_vis_${worldX}_${worldZ}`);
              if (!visual) continue;
              visual.parent = this.rootNode;
              visual.position.set(xPos, 0, zPos);
              visual.rotationQuaternion = null;
              visual.rotation.y = rotY;
              visual.isWalkableEnvironment = true;
              // isPickable pour le Raycast sol
              visual.isPickable = true;
              visual.checkCollisions = false;
              visual.getChildMeshes().forEach((m) => {
                m.isPickable = true;
                m.checkCollisions = false;
              });
              visual.setEnabled(true);
              visual.isVisible = true;
              this.instances.push(visual);
            }
          }

          // --- SPAWN DECORATIONS SUR BORD ---
          const absHash = Math.abs(hash);
          if (absHash % 100 < 3) {
            // 3% de chance sur les bords (baissé)
            let decoCount = (absHash % 2) + 1; // 1 à 2 objets
            const decoPool = [
              "rocks_A",
              "rocks_B",
              "rocks_C",
              "rocks_D",
              "rocks_E",
              "rocks_F",
              "rocks_G",
              "rubble_A",
              "rubble_B",
              "burned_tree_A",
              "burned_tree_B",
              "burned_tree_C",
            ];

            let availableSlots = [
              { x: -0.45, z: 0.45 },
              { x: 0.45, z: 0.45 },
              { x: -0.45, z: -0.45 },
              { x: 0.45, z: -0.45 },
            ];

            // Ajustement pour rester du côté sol (pousser loin du trou)
            if (top) availableSlots = availableSlots.filter((s) => s.z < 0);
            if (bottom) availableSlots = availableSlots.filter((s) => s.z > 0);
            if (left) availableSlots = availableSlots.filter((s) => s.x > 0);
            if (right) availableSlots = availableSlots.filter((s) => s.x < 0);

            if (availableSlots.length === 0) {
              availableSlots = [{ x: 0, z: 0 }]; // Fallback
            }

            // Mélange déterministe
            for (let j = availableSlots.length - 1; j > 0; j--) {
              const k = (absHash + j) % (j + 1);
              [availableSlots[j], availableSlots[k]] = [
                availableSlots[k],
                availableSlots[j],
              ];
            }

            let actualCount = Math.min(decoCount, availableSlots.length);

            for (let i = 0; i < actualCount; i++) {
              const subHash = Math.abs(
                this.noiseGen.hash(worldX + i * 100, worldZ + i * 100),
              );
              const decoName = decoPool[subHash % decoPool.length];

              // ANTI-OVERLAP : Les arbres sont seuls
              if (decoName.includes("tree")) {
                actualCount = 1;
              }

              const deco = assetLibrary.createInstance(
                decoName,
                `deco_${decoName}_bord_${worldX}_${worldZ}_${i}`,
              );

              if (deco) {
                deco.parent = this.rootNode;

                const offsetX = availableSlots[i].x;
                const offsetZ = availableSlots[i].z;

                const hY =
                  typeof window.debugDecoPosY !== "undefined" &&
                  decoName.includes("tree")
                    ? window.debugDecoPosY
                    : 1.0;
                deco.position.set(xPos + offsetX, hY, zPos + offsetZ);
                if (window.debugDecoEuler && decoName.includes("tree")) {
                  deco.rotationQuaternion = null; // Force Euler
                  deco.rotation.set(
                    window.debugDecoEuler.x,
                    window.debugDecoEuler.y,
                    window.debugDecoEuler.z,
                  );
                } else {
                  deco.rotationQuaternion = null; // Force Euler
                  const randY = ((subHash % 360) * Math.PI) / 180;
                  const randZ = (((subHash >> 4) % 360) * Math.PI) / 180;

                  let rotX = 0;
                  let rotZ = 0;

                  if (decoName.includes("rocks")) {
                    rotX = Math.PI / 2; // 90 deg
                    rotZ = randZ;
                  } else if (decoName.includes("tree")) {
                    rotX = 0; // À ajuster avec le debug
                    rotZ = 0;
                  }

                  deco.rotation.set(rotX, randY, rotZ);
                }
                // deco.rotation.y = (subHash % 4) * (Math.PI / 2);
                const isRubble = decoName.includes("rubble");
                if (!isRubble) {
                  deco.scaling.setAll(2);
                }
                deco.isObstacleEnvironment = !isRubble;
                deco.isPickable = true; // Toujours pickable pour le joueur dessus
                deco.checkCollisions = false;
                deco.getChildMeshes().forEach((m) => {
                  m.isPickable = true;
                  m.checkCollisions = false;
                  m.isVisible = true;
                });
                deco.setEnabled(true);
                deco.isVisible = true;
                this.instances.push(deco);
              }
            }
          }
        }
      }
    }

    // Appliquer les Thin Instances pour la lave (si encore utilisée)
    if (lavaMatrices.length > 0) {
      lavaMesh.thinInstanceSetBuffer(
        "matrix",
        new Float32Array(lavaMatrices),
        16,
      );
      lavaMesh.isPickable = true;
      lavaMesh.checkCollisions = true;
      lavaMesh.name = "lava_debug";
      this.instances.push(lavaMesh);
    } else {
      lavaMesh.dispose();
    }

    // Pas de freeze pour le debug
  }

  updateCollisions(playerPosition, maxDistance) {
    // Obsolete: Le raycast gère les collisions via isPickable. Plus besoin de checkCollisions manuel.
  }

  dispose() {
    for (let inst of this.instances) {
      inst.dispose();
    }
    this.instances = [];
    this.rootNode.dispose();
  }
}
