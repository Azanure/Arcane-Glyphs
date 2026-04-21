import { LakeGenerator } from '../math/LakeGenerator.js';
import { assetLibrary } from './AssetLibrary.js';

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

    const tex = new BABYLON.DynamicTexture(`tex_${type}`, {width: 128, height: 128}, scene);
    const ctx = tex.getContext();
    if (type === 2) ctx.fillStyle = "blue";
    else if (type === 3) ctx.fillStyle = "orange";
    else ctx.fillStyle = "black";
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
        this.rootNode = new BABYLON.TransformNode(`chunk_${chunkX}_${chunkZ}`, scene);
        this.rootNode.position.x = chunkX * CHUNK_SIZE * TILE_SIZE;
        this.rootNode.position.z = chunkZ * CHUNK_SIZE * TILE_SIZE;

        this.generate();
    }

    // Renvoie 0 (Lave), 1 (Sol), 2 (Trou) ou 3 (Bord)
    getNoiseAt(x, z) {
        // 1. PRIORITÉ ABSOLUE : La lave
        if (this.noiseGen.isLava(x, z)) return 0;

        // 2. TROUS : On vérifie les trous
        if (this.pitGen.isPit(x, z)) {
            // RÈGLE : Au moins 1 case entre lave et trou
            // On vérifie si un voisin direct est de la lave
            if (this.noiseGen.isLava(x+1, z) || this.noiseGen.isLava(x-1, z) || 
                this.noiseGen.isLava(x, z+1) || this.noiseGen.isLava(x, z-1)) {
                return 1; // On transforme le trou en sol pour garantir l'écart
            }
            return 2;
        }

        // 3. BORDS : Si on est du sol, on regarde s'il y a un trou à côté
        // On utilise ici une vérification simplifiée des voisins pour les trous validés
        if (this.isPitValidated(x+1, z) || this.isPitValidated(x-1, z) || 
            this.isPitValidated(x, z+1) || this.isPitValidated(x, z-1)) {
            return 3;
        }

        return 1;
    }

    // Helper pour savoir si une case est un "vrai" trou (pas annulé par la lave)
    isPitValidated(x, z) {
        if (!this.pitGen.isPit(x, z)) return false;
        if (this.noiseGen.isLava(x+1, z) || this.noiseGen.isLava(x-1, z) || 
            this.noiseGen.isLava(x, z+1) || this.noiseGen.isLava(x, z-1)) {
            return false;
        }
        return true;
    }

    generate() {
        const startX = this.chunkX * CHUNK_SIZE;
        const startZ = this.chunkZ * CHUNK_SIZE;

        // On ne crée plus soilMesh ni bordMesh car on utilise des instances individuelles
        const lavaMesh = BABYLON.MeshBuilder.CreateBox("chunk_lava_" + this.chunkX + "_" + this.chunkZ, { width: TILE_SIZE, height: 0.1, depth: TILE_SIZE }, this.scene);
        
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
                    const lavaCount = (top?1:0) + (right?1:0) + (bottom?1:0) + (left?1:0);

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
                        if (mask === 14) rotY = 3 * Math.PI / 2;                     // Sol en Haut (+Z) (mask 14 = R+B+L)
                        else if (mask === 13) rotY = 0;      // Sol à Droite (+X) (mask 13 = B+G+H)
                        else if (mask === 11) rotY = Math.PI / 2;          // Sol en Bas (-Z) (mask 11 = G+H+D)
                        else if (mask === 7) rotY = Math.PI;   // Sol à Gauche (-X) (mask 7 = H+D+B)
                    } else if (lavaCount === 2 && mask !== 5 && mask !== 10) {
                        // COIN (2 voisins adjacents)
                        variant = this.noiseGen.hash(worldX, worldZ) % 2 === 0 ? "A" : "B";
                        visualName = `lava_pit_inner_corner_${variant}`;
                        collisionName = `lava_pit_inner_corner_${variant}_lava`;
                        
                        // MAPPING CALIBRÉ : A (Top-Right par défaut), B (Bottom-Left par défaut)
                        if (variant === "A") {
                            if (mask === 3) rotY = Math.PI / 2;                     // Lave en Haut+Droite
                            else if (mask === 6) rotY = Math.PI;      // Lave en Droite+Bas
                            else if (mask === 12) rotY = 3 * Math.PI / 2;         // Lave en Bas+Gauche
                            else if (mask === 9) rotY = 0;  // Lave en Gauche+Haut
                        } else {
                            // Variante B est l'inverse de A (décalage 180°)
                            if (mask === 12) rotY = 3 * Math.PI / 2;                    // Lave en Bas+Gauche
                            else if (mask === 9) rotY = 0;       // Lave en Gauche+Haut
                            else if (mask === 3) rotY = Math.PI / 2;          // Lave en Haut+Droite
                            else if (mask === 6) rotY = Math.PI;   // Lave en Droite+Bas
                        }
                    }

                    if (visualName) {
                        const visual = assetLibrary.createInstance(visualName, `lava_vis_${worldX}_${worldZ}`);
                        const sourceLava = assetLibrary.meshes.get(collisionName);
                        const collision = sourceLava ? sourceLava.clone(`lava_col_${worldX}_${worldZ}`) : null;

                        if (visual && collision) {
                            const xPos = x * TILE_SIZE + (TILE_SIZE / 2);
                            const zPos = z * TILE_SIZE + (TILE_SIZE / 2);

                            [visual, collision].forEach(inst => {
                                inst.setEnabled(true);
                                inst.parent = this.rootNode;
                                inst.position.set(0, 0, 0); 
                                
                                // On RAZ le Quaternion car sinon .rotation est ignoré
                                inst.rotationQuaternion = null;
                                
                                inst.position.set(xPos, 0.01, zPos);
                                inst.rotation.y += rotY; // On AJOUTE la rotation au lieu de l'écraser

                                // Correctif spécifique : décalage de PI UNIQUEMENT pour la collision du COIN B
                                if (inst === collision && variant === "B" && visualName.includes("inner_corner")) {
                                    inst.rotation.y += Math.PI;
                                }
                                if (inst === collision && visualName.includes("middle")) {
                                    inst.rotation.y += Math.PI;
                                }

                                this.instances.push(inst);
                            });

                            // Configurer le rouge debug
                            collision.isVisible = true;
                            collision.isPickable = true;
                            collision.checkCollisions = false;
                            
                            const redMat = new BABYLON.StandardMaterial("redDebug", this.scene);
                            redMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
                            redMat.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
                            redMat.alpha = 0.4;
                            collision.material = redMat;
                            collision.getChildMeshes().forEach(m => {
                                m.material = redMat;
                                m.isVisible = true;
                            });
                        }
                    } else {
                        // Lave générique (petites plaques ou couloirs)
                        const xPos = x * TILE_SIZE + (TILE_SIZE / 2);
                        const zPos = z * TILE_SIZE + (TILE_SIZE / 2);
                        const matrix = BABYLON.Matrix.Translation(xPos, 0, zPos);
                        lavaMatrices.push(...matrix.asArray());
                    }
                } else if (type === 1) {
                    // SOL FINAL (ASSETS VARIÉS)
                    const xPos = x * TILE_SIZE + (TILE_SIZE / 2);
                    const zPos = z * TILE_SIZE + (TILE_SIZE / 2);
                    
                    let hash = this.noiseGen.hash(worldX, worldZ);
                    let visualName = "soil_clean_A"; // 80% par défaut
                    
                    if ((hash % 100) >= 80) {
                        // 20% de détails (ruines et fissures)
                        const others = [
                            "ruin_A", "ruin_B", "ruin_C", "ruin_D", "ruin_E",
                            "crack_A", "crack_B", "crack_C"
                        ];
                        visualName = others[hash % others.length];
                    }
                    
                    const visual = assetLibrary.createInstance(visualName, `soil_vis_${worldX}_${worldZ}`);
                    if (visual) {
                        visual.parent = this.rootNode;
                        visual.position.set(xPos, 0, zPos);
                        visual.rotationQuaternion = null;
                        // Rotation aléatoire déterministe par pas de 90°
                        visual.rotation.y = (hash % 4) * (Math.PI / 2);
                        visual.checkCollisions = true;
                        this.instances.push(visual);
                    }
                } else if (type === 3) {
                    // BORDURE FINALE (ASSETS)
                    const top = this.getNoiseAt(worldX, worldZ + 1) === 2;
                    const bottom = this.getNoiseAt(worldX, worldZ - 1) === 2;
                    const left = this.getNoiseAt(worldX - 1, worldZ) === 2;
                    const right = this.getNoiseAt(worldX + 1, worldZ) === 2;
                    
                    let pitCount = (top?1:0) + (bottom?1:0) + (left?1:0) + (right?1:0);
                    let mask = (top?1:0) + (right?2:0) + (bottom?4:0) + (left?8:0);
                    
                    let visualName = "";
                    let rotY = 0;
                    let hash = this.noiseGen.hash(worldX, worldZ);

                    if (pitCount === 1) {
                        const variants = ["middle_A", "middle_B", "middle_C"];
                        visualName = variants[hash % 3];
                        
                        // Logique de rotation Middle (à ajuster selon l'asset)
                        if (mask === 1) rotY = Math.PI;              // Trou en Haut
                        else if (mask === 2) rotY = 3*Math.PI/2;  // Trou à Droite
                        else if (mask === 4) rotY = 0;    // Trou en Bas
                        else if (mask === 8) rotY = Math.PI/2;// Trou à Gauche
                        
                    } else if (pitCount === 2) {
                        const variants = ["corner_A", "corner_B", "inner_A"];
                        visualName = variants[hash % 3];

                        // Logique de rotation Corner (à ajuster selon l'asset)
                        if (mask === 3) rotY = Math.PI;               // Trou en Haut + Droite
                        else if (mask === 6) rotY = 3*Math.PI/2;   // Trou en Droite + Bas
                        else if (mask === 12) rotY = 0;    // Trou en Bas + Gauche
                        else if (mask === 9) rotY = Math.PI/2; // Trou en Gauche + Haut
                    }
                    
                    if (visualName) {
                        const xPos = x * TILE_SIZE + (TILE_SIZE / 2);
                        const zPos = z * TILE_SIZE + (TILE_SIZE / 2);
                        const visual = assetLibrary.createInstance(visualName, `bord_vis_${worldX}_${worldZ}`);
                        if (visual) {
                            visual.parent = this.rootNode;
                            visual.position.set(xPos, 0, zPos);
                            visual.rotationQuaternion = null;
                            visual.rotation.y = rotY; 
                            visual.checkCollisions = true;
                            this.instances.push(visual);
                        }
                    }
                } else if (type === 2) {
                    // TROU (PIT) : Uniquement la collision invisible
                    const xPos = x * TILE_SIZE + (TILE_SIZE / 2);
                    const zPos = z * TILE_SIZE + (TILE_SIZE / 2);

                    const collision = BABYLON.MeshBuilder.CreateBox(`pit_col_${worldX}_${worldZ}`, {size: TILE_SIZE, height: 4}, this.scene);
                    collision.parent = this.rootNode;
                    collision.position.set(xPos, 2, zPos);
                    collision.isVisible = false; 
                    collision.isPickable = true;
                    // On ne met pas checkCollisions=true car on bloque par Raycast dans Player.js
                    // mais on peut le mettre si on veut utiliser le moteur physique interne plus tard.
                    
                    this.instances.push(collision);
                }
            }
        }

        // Appliquer les Thin Instances pour la lave (si encore utilisée)
        if (lavaMatrices.length > 0) {
            lavaMesh.thinInstanceSetBuffer("matrix", new Float32Array(lavaMatrices), 16);
            lavaMesh.isPickable = true;
            lavaMesh.checkCollisions = true;
            lavaMesh.name = "lava_debug";
            this.instances.push(lavaMesh);
        } else {
            lavaMesh.dispose();
        }

        // Pas de freeze pour le debug
    }

    dispose() {
        // Détruire toutes les instances
        for (let inst of this.instances) {
            inst.dispose();
        }
        this.instances = [];
        this.rootNode.dispose();
    }
}
