const fs = require('fs');

try {
    const buffer = fs.readFileSync('assets/temple/temple_assets.glb');
    const chunkLength = buffer.readUInt32LE(12);
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const gltf = JSON.parse(jsonBuffer.toString('utf8'));
    
    console.log("--- Relevant Nodes in temple_assets.glb ---");
    gltf.nodes.forEach((node, index) => {
        if (node.name.toLowerCase().includes("wall") || node.name.toLowerCase().includes("floor")) {
            console.log(`Node ${index}: name="${node.name}", translation=${JSON.stringify(node.translation)}, scale=${JSON.stringify(node.scale)}, rotation=${JSON.stringify(node.rotation)}`);
        }
    });

    console.log("--- Meshes in temple_assets.glb ---");
    if (gltf.meshes) {
        gltf.meshes.forEach((mesh, index) => {
            console.log(`Mesh ${index}: name="${mesh.name}"`);
        });
    }

} catch (e) {
    console.error("Error:", e);
}
