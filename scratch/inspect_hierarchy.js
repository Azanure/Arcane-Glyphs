const fs = require('fs');

try {
    const buffer = fs.readFileSync('assets/temple/temple_assets.glb');
    const chunkLength = buffer.readUInt32LE(12);
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const gltf = JSON.parse(jsonBuffer.toString('utf8'));

    console.log("--- Nodes and Children ---");
    gltf.nodes.forEach((node, idx) => {
        if (node.name.toLowerCase().includes("wall")) {
            console.log(`Node ${idx}: name="${node.name}" children=${JSON.stringify(node.children)} mesh=${node.mesh} translation=${JSON.stringify(node.translation)} rotation=${JSON.stringify(node.rotation)} scale=${JSON.stringify(node.scale)}`);
        }
    });

} catch (e) {
    console.error("Error:", e);
}

