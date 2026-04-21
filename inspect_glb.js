const fs = require('fs');

try {
    const buffer = fs.readFileSync('assets/worlds/lava_world/lava_world.glb');
    const chunkLength = buffer.readUInt32LE(12);
    const jsonBuffer = buffer.slice(20, 20 + chunkLength);
    const gltf = JSON.parse(jsonBuffer.toString('utf8'));
    
    const targets = ["lava_pit_middle_A", "lava_pit_middle_B", "lava_pit_corner", "soil_corner"];
    
    targets.forEach(baseName => {
        console.log(`--- Analysis of ${baseName} ---`);
        [".lava", ".soil", "_lava", "_soil"].forEach(suffix => {
            const nodeName = baseName + suffix;
            const node = gltf.nodes.find(n => n.name === nodeName);
            if (node) {
                console.log(`  ${nodeName}: Translation [${node.translation || "0,0,0"}]`);
            }
        });
    });

} catch (e) {
    console.error("Error:", e);
}
