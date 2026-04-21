// Script de diagnostic pour trouver l'orientation des tuiles
import { AssetLibrary } from './js/level/AssetLibrary.js';

async function analyzeAsset(meshName, assetLibrary, scene) {
    const lavaSub = assetLibrary.meshes.get(meshName + "_lava");
    const soilSub = assetLibrary.meshes.get(meshName + "_soil");
    
    if (lavaSub && soilSub) {
        lavaSub.computeWorldMatrix(true);
        soilSub.computeWorldMatrix(true);
        
        const lavaCenter = lavaSub.getBoundingInfo().boundingBox.centerWorld;
        const soilCenter = soilSub.getBoundingInfo().boundingBox.centerWorld;
        
        const diff = lavaCenter.subtract(soilCenter);
        console.log(`[ANALYSIS] ${meshName}:`);
        console.log(`  Lava at: ${lavaCenter.x.toFixed(2)}, ${lavaCenter.z.toFixed(2)}`);
        console.log(`  Soil at: ${soilCenter.x.toFixed(2)}, ${soilCenter.z.toFixed(2)}`);
        
        if (Math.abs(diff.x) > Math.abs(diff.z)) {
            console.log(`  Orientation: Horizontale (Lave à ${diff.x > 0 ? 'Droite +X' : 'Gauche -X'})`);
        } else {
            console.log(`  Orientation: Verticale (Lave à ${diff.z > 0 ? 'Haut +Z' : 'Bas -Z'})`);
        }
    } else {
        console.log(`[ANALYSIS] ${meshName}: Sous-meshes manquants.`);
    }
}
