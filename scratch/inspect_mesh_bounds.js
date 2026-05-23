const fs = require('fs');

try {
    const buffer = fs.readFileSync('assets/temple/temple_assets.glb');
    const chunkLength = buffer.readUInt32LE(12);
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const gltf = JSON.parse(jsonBuffer.toString('utf8'));

    console.log("--- Accessing Wall Mesh Primitives Bounding Boxes ---");
    gltf.nodes.forEach((node, nodeIdx) => {
        if (node.name.toLowerCase().includes("wall")) {
            if (node.mesh !== undefined) {
                const mesh = gltf.meshes[node.mesh];
                console.log(`Node ${nodeIdx}: name="${node.name}" (Mesh ${node.mesh}: "${mesh.name}")`);
                mesh.primitives.forEach((prim, primIdx) => {
                    const posAccessorIdx = prim.attributes.POSITION;
                    if (posAccessorIdx !== undefined) {
                        const accessor = gltf.accessors[posAccessorIdx];
                        console.log(`  Primitive ${primIdx}: min=${JSON.stringify(accessor.min)}, max=${JSON.stringify(accessor.max)}`);
                    }
                });
            } else {
                console.log(`Node ${nodeIdx}: name="${node.name}" has no mesh directly`);
            }
        }
    });

} catch (e) {
    console.error("Error:", e);
}

