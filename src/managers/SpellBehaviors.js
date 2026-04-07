export const SpellBehaviors = {
    PROJECTILE_AOE: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        if (!target) return;

        let sphere = BABYLON.MeshBuilder.CreateSphere("projectile", {diameter: 1}, scene);
        let mat = new BABYLON.StandardMaterial("projMat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0); // Kept similar visually
        sphere.material = mat;
        sphere.position = player.mesh.position.clone();
        sphere.position.y = 1;

        let direction = target.mesh.position.subtract(sphere.position);
        direction.normalize();

        let speed = 0.5;
        let frame = 0;

        let animObserver = scene.onBeforeRenderObservable.add(() => {
            frame++;
            if (frame > 100 || sphere.isDisposed()) {
                scene.onBeforeRenderObservable.remove(animObserver);
                if (!sphere.isDisposed()) sphere.dispose();
                return;
            }

            sphere.position.addInPlace(direction.scale(speed));

            for (let enemy of enemies) {
                if (enemy.isDead) continue;
                if (BABYLON.Vector3.Distance(sphere.position, enemy.mesh.position) < 1.5) {
                    
                    let radius = spellConfig.radius || 5;
                    let explosion = BABYLON.MeshBuilder.CreateSphere("explosion", {diameter: radius * 2}, scene);
                    let expMat = new BABYLON.StandardMaterial("expMat", scene);
                    expMat.emissiveColor = new BABYLON.Color3(1, 0.2, 0);
                    expMat.alpha = 0.5;
                    explosion.material = expMat;
                    explosion.position = sphere.position.clone();

                    setTimeout(() => explosion.dispose(), 200);

                    for (let e of enemies) {
                        if (e.isDead) continue;
                        if (BABYLON.Vector3.Distance(explosion.position, e.mesh.position) <= radius) {
                            applyEffectsCallback(e, spellConfig.effects);
                        }
                    }

                    scene.onBeforeRenderObservable.remove(animObserver);
                    sphere.dispose();
                    break;
                }
            }
        });
    },

    AURA: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        let radius = spellConfig.radius || 10;
        let aura = BABYLON.MeshBuilder.CreateCylinder("aura", {diameter: radius * 2, height: 0.5}, scene);
        let mat = new BABYLON.StandardMaterial("auraMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
        mat.alpha = 0.4;
        aura.material = mat;
        aura.position = player.mesh.position.clone();
        aura.position.y = 0.25;

        setTimeout(() => aura.dispose(), 300);

        for (let enemy of enemies) {
            if (enemy.isDead) continue;
            if (BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position) <= radius) {
                applyEffectsCallback(enemy, spellConfig.effects);
            }
        }
    },

    CONE: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        let dir = target ? target.mesh.position.subtract(player.mesh.position) : new BABYLON.Vector3(1, 0, 0);
        dir.y = 0;
        dir.normalize();

        let wave = BABYLON.MeshBuilder.CreateBox("coneSpl", {size: 1}, scene);
        let mat = new BABYLON.StandardMaterial("coneMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.3, 0.1);
        wave.material = mat;
        wave.position = player.mesh.position.clone();
        wave.position.y = 0.5;

        // Simple scaling animation
        let scale = 1;
        let pObserver = scene.onBeforeRenderObservable.add(() => {
            scale += 1;
            wave.scaling.x = scale;
            wave.scaling.z = scale;
            wave.position.addInPlace(dir.scale(1));
            if (scale > spellConfig.distance) {
                scene.onBeforeRenderObservable.remove(pObserver);
                wave.dispose();
            }
        });

        let angleCos = Math.cos((spellConfig.angle || 45) * (Math.PI / 180));
        
        for (let enemy of enemies) {
            if (enemy.isDead) continue;
            
            let enemyVec = enemy.mesh.position.subtract(player.mesh.position);
            enemyVec.y = 0;
            let dist = enemyVec.length();

            if (dist <= spellConfig.distance) {
                enemyVec.normalize();
                let dot = BABYLON.Vector3.Dot(dir, enemyVec);
                if (dot >= angleCos) { // Roughly inside cone
                    applyEffectsCallback(enemy, spellConfig.effects);
                }
            }
        }
    }
};
