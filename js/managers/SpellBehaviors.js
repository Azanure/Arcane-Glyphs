function createFireAoESpell(scene, playerMesh, radius) {
    // 1. Base lumineuse : Anneau au sol
    let baseRing = BABYLON.MeshBuilder.CreateTorus("fireRingBase", { diameter: radius * 2, thickness: 0.2, tessellation: 64 }, scene);
    let mat = new BABYLON.StandardMaterial("fireRingMat", scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0.4, 0); // Jaune/orange intense
    mat.alpha = 0.8;
    mat.disableLighting = true;
    baseRing.material = mat;
    baseRing.isPickable = false; // CRUCIAL : Ne pas bloquer les raycasts du joueur

    // Position au sol, parenté au joueur
    baseRing.position.y = -0.5; // Ajuster selon le modèle du joueur
    baseRing.parent = playerMesh;

    // S'assurer qu'un GlowLayer existe
    let glowLayer = scene.getGlowLayerByName("glow");
    if (!glowLayer) {
        glowLayer = new BABYLON.GlowLayer("glow", scene);
        glowLayer.intensity = 1.0;
    }
    glowLayer.addIncludedOnlyMesh(baseRing);

    // 2. Particules de flammes
    let particleSystem = new BABYLON.ParticleSystem("fireAoEParticles", 4000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("assets/textures/fire_flare.png", scene);
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD; // IMPORTANT pour le feu

    // Emetteur cylindrique
    let emitter = particleSystem.createCylinderEmitter(radius, 0.1, 0, 0);
    emitter.radiusRange = 0; // Emet UNIQUEMENT sur le bord de l'anneau, pas à l'intérieur
    // On force la direction vers le haut
    emitter.directionRandomizer = 0;

    // Attacher l'émetteur au joueur pour que l'AoE le suive
    particleSystem.emitter = playerMesh;

    // Couleurs (Rouge et Orange intense)
    particleSystem.color1 = new BABYLON.Color4(1.0, 0.3, 0.0, 1.0); // Orange/Rouge
    particleSystem.color2 = new BABYLON.Color4(1.0, 0.0, 0.0, 1.0); // Rouge vif
    particleSystem.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);

    // Taille et durée pour s'étirer en hauteur
    particleSystem.minSize = 0.8;
    particleSystem.maxSize = 2.0;
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.6;
    particleSystem.emitRate = 1500; // Mur très dense

    // Vitesse (direction vers le haut uniquement sur l'axe Y)
    particleSystem.gravity = new BABYLON.Vector3(0, 5, 0);
    particleSystem.direction1 = new BABYLON.Vector3(0, 1, 0);
    particleSystem.direction2 = new BABYLON.Vector3(0, 1.5, 0);
    particleSystem.minEmitPower = 3;
    particleSystem.maxEmitPower = 6;
    particleSystem.updateSpeed = 0.01;

    particleSystem.start();

    return { particleSystem, baseRing };
}

function createInfernoAoESpell(scene, playerMesh, radius) {
    // 1. Base lumineuse : Disque magma au sol (élevé pour ne pas clipper)
    let baseDisk = BABYLON.MeshBuilder.CreateDisc("infernoBase", { radius: radius, tessellation: 64 }, scene);
    baseDisk.rotation.x = Math.PI / 2;

    let mat = new BABYLON.StandardMaterial("infernoMat", scene);
    mat.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0); // Rouge magma profond

    mat.alpha = 0.8;
    mat.disableLighting = true;
    baseDisk.material = mat;
    baseDisk.isPickable = false;

    baseDisk.position.y = 0.05; // Juste au dessus du sol pour éviter le z-fighting/clipping
    baseDisk.parent = playerMesh;

    // 2. Particules de flammes stylisées
    let flameSystem = new BABYLON.ParticleSystem("infernoFlames", 300, scene);
    flameSystem.particleTexture = new BABYLON.Texture("assets/textures/inferno_flame_particle.png", scene);
    flameSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    let flameEmitter = flameSystem.createCylinderEmitter(radius * 0.9, 0.1, 0, 0);
    flameEmitter.radiusRange = 1;
    flameSystem.emitter = playerMesh;

    flameSystem.color1 = new BABYLON.Color4(1.0, 0.8, 0.2, 0.9);
    flameSystem.color2 = new BABYLON.Color4(1.0, 0.2, 0.0, 0.7);
    flameSystem.colorDead = new BABYLON.Color4(0.5, 0.0, 0.0, 0.0);

    flameSystem.minSize = 1.0;
    flameSystem.maxSize = 2.5;
    flameSystem.minLifeTime = 0.5;
    flameSystem.maxLifeTime = 1.2;
    flameSystem.emitRate = 200; // Un bon feu constant

    flameSystem.gravity = new BABYLON.Vector3(0, 3, 0);
    flameSystem.direction1 = new BABYLON.Vector3(-0.5, 2, -0.5);
    flameSystem.direction2 = new BABYLON.Vector3(0.5, 3, 0.5);
    flameSystem.minEmitPower = 1;
    flameSystem.maxEmitPower = 3;
    flameSystem.updateSpeed = 0.01;
    flameSystem.start();

    // 3. Braises volantes (Sparkles)
    let sparkSystem = new BABYLON.ParticleSystem("infernoSparks", 200, scene);
    sparkSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
    sparkSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    let sparkEmitter = sparkSystem.createCylinderEmitter(radius, 0.1, 0, 0);
    sparkEmitter.radiusRange = 1;
    sparkSystem.emitter = playerMesh;

    sparkSystem.color1 = new BABYLON.Color4(1.0, 0.9, 0.2, 1.0);
    sparkSystem.color2 = new BABYLON.Color4(1.0, 0.5, 0.0, 1.0);
    sparkSystem.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);

    sparkSystem.minSize = 0.1;
    sparkSystem.maxSize = 0.3;
    sparkSystem.minLifeTime = 1.0;
    sparkSystem.maxLifeTime = 2.5;
    sparkSystem.emitRate = 100;

    sparkSystem.gravity = new BABYLON.Vector3(0, 4, 0);
    sparkSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
    sparkSystem.direction2 = new BABYLON.Vector3(1, 4, 1);
    sparkSystem.minEmitPower = 2;
    sparkSystem.maxEmitPower = 5;
    sparkSystem.updateSpeed = 0.01;
    sparkSystem.start();

    return { particleSystem: flameSystem, sparkSystem: sparkSystem, baseDisk };
}

export const SpellBehaviors = {
    PROJECTILE_AOE: (scene, spellConfig, player, enemies, target, applyEffectsCallback, targetDirection) => {
        let direction = targetDirection;
        if (!direction) {
            if (!target) return;
            direction = target.mesh.position.subtract(player.mesh.position);
            direction.normalize();
        }

        if (spellConfig.id === "FIREBALL") {
            let projectilesCount = spellConfig.projectiles || 1;
            let currentRadius = spellConfig.radius || 5;
            let radiusScale = currentRadius / 5;

            let spawnFireball = (dirOffsetAngle) => {
                let currentDir = direction.clone();
                if (dirOffsetAngle !== 0) {
                    let matrix = BABYLON.Matrix.RotationY(dirOffsetAngle);
                    currentDir = BABYLON.Vector3.TransformCoordinates(currentDir, matrix);
                }

                let sphere = BABYLON.MeshBuilder.CreateSphere("fireball", { diameter: 0.8 * radiusScale }, scene);
                let mat = new BABYLON.StandardMaterial("fireballMat", scene);
                mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
                mat.diffuseColor = new BABYLON.Color3(1, 0, 0);
                mat.alpha = 0.2;
                sphere.material = mat;
                sphere.isPickable = false;
                sphere.position = player.mesh.position.clone();
                sphere.position.y += 1.5;

                let particleSystem = new BABYLON.ParticleSystem("fireParticles", 200, scene);
                particleSystem.particleTexture = new BABYLON.Texture("assets/textures/fireball_flame.png", scene);
                particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                particleSystem.emitter = sphere;
                particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0, 1.0);
                particleSystem.color2 = new BABYLON.Color4(1, 0.2, 0, 1.0);
                particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
                particleSystem.minSize = 0.6 * radiusScale;
                particleSystem.maxSize = 1.2 * radiusScale;
                particleSystem.minLifeTime = 0.2;
                particleSystem.maxLifeTime = 0.4;
                particleSystem.emitRate = 400;
                particleSystem.createSphereEmitter(0.5 * radiusScale);
                particleSystem.minEmitPower = 1;
                particleSystem.maxEmitPower = 2;
                particleSystem.updateSpeed = 0.01;
                particleSystem.start();

                let smokeSystem = new BABYLON.ParticleSystem("smokeParticles", 150, scene);
                smokeSystem.particleTexture = new BABYLON.Texture("assets/textures/fireball_smoke.png", scene);
                smokeSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                smokeSystem.emitter = sphere;
                smokeSystem.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.6);
                smokeSystem.color2 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.3);
                smokeSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
                smokeSystem.minSize = 0.5 * radiusScale;
                smokeSystem.maxSize = 1.5 * radiusScale;
                smokeSystem.minLifeTime = 0.4;
                smokeSystem.maxLifeTime = 0.8;
                smokeSystem.emitRate = 100;
                smokeSystem.createSphereEmitter(0.5 * radiusScale);
                smokeSystem.minEmitPower = 0.5;
                smokeSystem.maxEmitPower = 1.5;
                smokeSystem.updateSpeed = 0.01;
                smokeSystem.start();

                let speed = 0.2;
                let frame = 0;

                let animObserver = scene.onBeforeRenderObservable.add(() => {
                    frame++;
                    if (frame > 250 || sphere.isDisposed()) {
                        scene.onBeforeRenderObservable.remove(animObserver);
                        particleSystem.stop();
                        smokeSystem.stop();
                        setTimeout(() => {
                            particleSystem.dispose();
                            smokeSystem.dispose();
                        }, 1000);
                        if (!sphere.isDisposed()) sphere.dispose();
                        return;
                    }

                    sphere.position.addInPlace(currentDir.scale(speed));

                    let hitEnemy = null;
                    let detectionDistance = 2.0 * radiusScale;
                    for (let enemy of enemies) {
                        if (enemy.isDead) continue;
                        if (BABYLON.Vector3.Distance(sphere.position, enemy.mesh.position) < detectionDistance) {
                            hitEnemy = enemy;
                            break;
                        }
                    }

                    if (hitEnemy || sphere.position.y < 0) {
                        if (hitEnemy) {
                            applyEffectsCallback(hitEnemy, spellConfig.effects);
                        }

                        let flashSys = new BABYLON.ParticleSystem("flashSys", 50, scene);
                        flashSys.particleTexture = new BABYLON.Texture("assets/textures/fireball_impact.png", scene);
                        flashSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                        flashSys.emitter = sphere.position.clone();
                        flashSys.color1 = new BABYLON.Color4(1, 1, 1, 1.0);
                        flashSys.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0);
                        flashSys.colorDead = new BABYLON.Color4(1, 0, 0, 0.0);
                        flashSys.minSize = 2.0 * radiusScale;
                        flashSys.maxSize = 4.0 * radiusScale;
                        flashSys.minLifeTime = 0.1;
                        flashSys.maxLifeTime = 0.2;
                        flashSys.emitRate = 1000;
                        flashSys.targetStopDuration = 0.1;
                        flashSys.createPointEmitter(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 0));
                        flashSys.start();

                        let impactSmoke = new BABYLON.ParticleSystem("impactSmoke", 100, scene);
                        impactSmoke.particleTexture = new BABYLON.Texture("assets/textures/fireball_smoke.png", scene);
                        impactSmoke.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                        impactSmoke.emitter = sphere.position.clone();
                        impactSmoke.color1 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.8);
                        impactSmoke.color2 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.3);
                        impactSmoke.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
                        impactSmoke.minSize = 1.0 * radiusScale;
                        impactSmoke.maxSize = 3.0 * radiusScale;
                        impactSmoke.minLifeTime = 0.5;
                        impactSmoke.maxLifeTime = 1.0;
                        impactSmoke.emitRate = 1000;
                        impactSmoke.targetStopDuration = 0.2;
                        impactSmoke.createSphereEmitter(1.5 * radiusScale);
                        impactSmoke.minEmitPower = 1;
                        impactSmoke.maxEmitPower = 3;
                        impactSmoke.start();

                        scene.onBeforeRenderObservable.remove(animObserver);
                        particleSystem.stop();
                        smokeSystem.stop();
                        setTimeout(() => {
                            particleSystem.dispose();
                            smokeSystem.dispose();
                            flashSys.dispose();
                            impactSmoke.dispose();
                        }, 1500);
                        sphere.dispose();
                    }
                });
            };

            let angleStep = 0.3; // ~17 degrees spacing
            let startAngle = -((projectilesCount - 1) * angleStep) / 2;

            for (let i = 0; i < projectilesCount; i++) {
                spawnFireball(startAngle + i * angleStep);
            }
            return;
        }

        // Fallback for other PROJECTILE_AOE (like VOID_HOLE)
        let sphere = BABYLON.MeshBuilder.CreateSphere("projectile", { diameter: 1 }, scene);
        let mat = new BABYLON.StandardMaterial("projMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
        sphere.material = mat;
        sphere.isPickable = false;
        sphere.position = player.mesh.position.clone();
        sphere.position.y = 1;

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
                    let explosion = BABYLON.MeshBuilder.CreateSphere("explosion", { diameter: radius * 2 }, scene);
                    let expMat = new BABYLON.StandardMaterial("expMat", scene);
                    expMat.emissiveColor = new BABYLON.Color3(0.5, 0, 0.5);
                    expMat.alpha = 0.5;
                    explosion.material = expMat;
                    explosion.isPickable = false;
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

        if (spellConfig.id === "INFERNO") {
            const vfx = createInfernoAoESpell(scene, player.mesh, radius);

            let ticks = 0;
            let duration = spellConfig.cooldown ? spellConfig.cooldown * 1000 : 5000;

            let dmgObserver = scene.onBeforeRenderObservable.add(() => {
                ticks += scene.getEngine().getDeltaTime();
                if (ticks > 500) { // Chaque 500ms
                    ticks = 0;
                    for (let enemy of enemies) {
                        if (enemy.isDead) continue;
                        if (BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position) <= radius) {
                            applyEffectsCallback(enemy, spellConfig.effects);
                        }
                    }
                }
            });

            setTimeout(() => {
                scene.onBeforeRenderObservable.remove(dmgObserver);
                if (vfx.particleSystem) vfx.particleSystem.stop();
                if (vfx.sparkSystem) vfx.sparkSystem.stop();
                setTimeout(() => {
                    if (vfx.particleSystem) vfx.particleSystem.dispose();
                    if (vfx.sparkSystem) vfx.sparkSystem.dispose();
                }, 1000);
                if (vfx.baseDisk) vfx.baseDisk.dispose();
            }, duration);

            return;
        }

        if (spellConfig.id === "FIRE_RING") {
            const vfx = createFireAoESpell(scene, player.mesh, radius);

            let ticks = 0;
            let duration = 5000;

            let dmgObserver = scene.onBeforeRenderObservable.add(() => {
                ticks += scene.getEngine().getDeltaTime();
                if (ticks > 500) {
                    ticks = 0;
                    for (let enemy of enemies) {
                        if (enemy.isDead) continue;
                        if (BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position) <= radius) {
                            applyEffectsCallback(enemy, spellConfig.effects);
                        }
                    }
                }
            });

            setTimeout(() => {
                scene.onBeforeRenderObservable.remove(dmgObserver);
                vfx.particleSystem.stop();
                setTimeout(() => vfx.particleSystem.dispose(), 1000);
                vfx.baseRing.dispose();
            }, duration);

            return;
        }

        if (spellConfig.id === "WIND_DOMAIN") {
            // Visuals
            let ring = BABYLON.MeshBuilder.CreateTorus("windRing", { diameter: radius * 2, thickness: 0.1, tessellation: 64 }, scene);
            let mat = new BABYLON.StandardMaterial("windMat", scene);
            mat.emissiveColor = new BABYLON.Color3(0.5, 0.8, 1.0);
            mat.alpha = 0.5;
            mat.disableLighting = true;
            ring.material = mat;
            ring.isPickable = false;
            ring.parent = player.mesh;
            ring.position.y = 0.05;

            let pSys = new BABYLON.ParticleSystem("windSys", 200, scene);
            pSys.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
            pSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            pSys.emitter = player.mesh;
            let em = pSys.createCylinderEmitter(radius, 0.5, 0, 0);
            em.radiusRange = 1; // Emit from entire circle
            pSys.color1 = new BABYLON.Color4(0.8, 1.0, 1.0, 0.5);
            pSys.color2 = new BABYLON.Color4(0.5, 0.8, 1.0, 0.2);
            pSys.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
            pSys.minSize = 0.2;
            pSys.maxSize = 0.8;
            pSys.minLifeTime = 0.5;
            pSys.maxLifeTime = 1.0;
            pSys.emitRate = 200;
            pSys.updateSpeed = 0.02;
            // Tourbillonnant
            pSys.gravity = new BABYLON.Vector3(0, 2, 0);
            pSys.start();

            let ticks = 0;
            let duration = (spellConfig.duration || 6) * 1000;

            let rotObserver = scene.onBeforeRenderObservable.add(() => {
                ring.rotation.y += 0.05;

                ticks += scene.getEngine().getDeltaTime();
                if (ticks > 500) {
                    ticks = 0;
                    for (let enemy of enemies) {
                        if (enemy.isDead) continue;
                        if (BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position) <= radius) {
                            applyEffectsCallback(enemy, spellConfig.effects); // Apply SLOW
                        }
                    }
                }
            });

            setTimeout(() => {
                scene.onBeforeRenderObservable.remove(rotObserver);
                pSys.stop();
                setTimeout(() => pSys.dispose(), 1000);
                ring.dispose();
            }, duration);

            return;
        }

        let aura = BABYLON.MeshBuilder.CreateCylinder("aura", { diameter: radius * 2, height: 0.5 }, scene);
        let mat = new BABYLON.StandardMaterial("auraMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
        mat.alpha = 0.4;
        aura.material = mat;
        aura.isPickable = false;
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

    TRAP: (scene, spellConfig, player, enemies, target, applyEffectsCallback, targetDirection) => {
        let spawnPos = player.mesh.position.clone();
        if (targetDirection) {
            let flatDir = targetDirection.clone();
            flatDir.y = 0;
            flatDir.normalize();
            spawnPos.addInPlace(flatDir.scale(2)); // Placer 2m devant
        } else {
            spawnPos.addInPlace(new BABYLON.Vector3(0, 0, 2));
        }
        spawnPos.y = 1.0; // Surélevé pour être sûr de ne pas clipper dans le sol

        let bomb = BABYLON.MeshBuilder.CreateSphere("fireBomb", { diameter: 1, segments: 32 }, scene);
        let mat = new BABYLON.StandardMaterial("bombMat", scene);
        mat.diffuseTexture = new BABYLON.Texture("assets/textures/fire_bomb_texture.png", scene);
        mat.emissiveTexture = mat.diffuseTexture;
        mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0.2); // Teinte incandescente
        bomb.material = mat;
        bomb.isPickable = false;
        bomb.position = spawnPos;

        // Aura de feu autour de la bombe
        let auraSys = new BABYLON.ParticleSystem("bombAura", 100, scene);
        auraSys.particleTexture = new BABYLON.Texture("assets/textures/inferno_flame_particle.png", scene);
        auraSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        auraSys.emitter = bomb;
        auraSys.color1 = new BABYLON.Color4(1.0, 0.5, 0.0, 0.8);
        auraSys.color2 = new BABYLON.Color4(1.0, 0.1, 0.0, 0.4);
        auraSys.colorDead = new BABYLON.Color4(0.0, 0.0, 0.0, 0.0);
        auraSys.minSize = 0.3;
        auraSys.maxSize = 0.8;
        auraSys.minLifeTime = 0.2;
        auraSys.maxLifeTime = 0.5;
        auraSys.emitRate = 80;
        let auraEmitter = auraSys.createSphereEmitter(0.6);
        auraSys.minEmitPower = 0.1;
        auraSys.maxEmitPower = 0.3;
        auraSys.updateSpeed = 0.01;
        auraSys.start();

        let t = 0;
        let observer = scene.onBeforeRenderObservable.add(() => {
            t += 0.1;
            let scale = 1 + Math.sin(t) * 0.1;
            bomb.scaling.set(scale, scale, scale);

            for (let enemy of enemies) {
                if (enemy.isDead) continue;
                if (BABYLON.Vector3.Distance(bomb.position, enemy.mesh.position) <= 1.5) {
                    let radius = spellConfig.radius || 4;
                    for (let e of enemies) {
                        if (e.isDead) continue;
                        if (BABYLON.Vector3.Distance(bomb.position, e.mesh.position) <= radius) {
                            applyEffectsCallback(e, spellConfig.effects);
                        }
                    }

                    let flashSys = new BABYLON.ParticleSystem("flashSys", 50, scene);
                    flashSys.particleTexture = new BABYLON.Texture("assets/textures/fireball_impact.png", scene);
                    flashSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                    flashSys.emitter = bomb.position.clone();
                    flashSys.color1 = new BABYLON.Color4(1, 1, 1, 1.0);
                    flashSys.color2 = new BABYLON.Color4(1, 0.5, 0, 1.0);
                    flashSys.colorDead = new BABYLON.Color4(1, 0, 0, 0.0);
                    flashSys.minSize = 4.0;
                    flashSys.maxSize = 6.0;
                    flashSys.minLifeTime = 0.1;
                    flashSys.maxLifeTime = 0.2;
                    flashSys.emitRate = 1000;
                    flashSys.targetStopDuration = 0.1;
                    flashSys.createPointEmitter(new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 0));
                    flashSys.start();

                    let impactSmoke = new BABYLON.ParticleSystem("impactSmoke", 100, scene);
                    impactSmoke.particleTexture = new BABYLON.Texture("assets/textures/fireball_smoke.png", scene);
                    impactSmoke.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                    impactSmoke.emitter = bomb.position.clone();
                    impactSmoke.color1 = new BABYLON.Color4(0.6, 0.6, 0.6, 0.8);
                    impactSmoke.color2 = new BABYLON.Color4(0.2, 0.2, 0.2, 0.3);
                    impactSmoke.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
                    impactSmoke.minSize = 2.0;
                    impactSmoke.maxSize = 5.0;
                    impactSmoke.minLifeTime = 0.5;
                    impactSmoke.maxLifeTime = 1.0;
                    impactSmoke.emitRate = 1000;
                    impactSmoke.targetStopDuration = 0.2;
                    impactSmoke.createSphereEmitter(2);
                    impactSmoke.minEmitPower = 1;
                    impactSmoke.maxEmitPower = 4;
                    impactSmoke.start();

                    setTimeout(() => {
                        flashSys.dispose();
                        impactSmoke.dispose();
                        auraSys.dispose();
                    }, 1500);

                    scene.onBeforeRenderObservable.remove(observer);
                    auraSys.stop();
                    bomb.dispose();
                    break;
                }
            }
        });
    },

    TRAIL: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        let duration = spellConfig.duration ? spellConfig.duration * 1000 : 5000;
        let elapsed = 0;
        let lastPos = player.mesh.position.clone();
        let patches = [];

        let dropObserver = scene.onBeforeRenderObservable.add(() => {
            let dt = scene.getEngine().getDeltaTime();
            elapsed += dt;

            if (BABYLON.Vector3.Distance(player.mesh.position, lastPos) >= 1.0) {
                let pos = player.mesh.position.clone();
                pos.y = 1.01; // Surélevé pour ne pas clipper dans le sol
                lastPos = pos.clone();

                let patch = BABYLON.MeshBuilder.CreateDisc("trailPatch", { radius: spellConfig.radius || 1.5, tessellation: 32 }, scene);
                patch.rotation.x = Math.PI / 2;
                let mat = new BABYLON.StandardMaterial("trailMat", scene);
                mat.diffuseTexture = new BABYLON.Texture("assets/textures/scorched_earth_trail.png", scene);
                mat.emissiveTexture = mat.diffuseTexture;
                mat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
                mat.disableLighting = true;
                mat.alpha = 0.8;
                patch.material = mat;
                patch.isPickable = false;
                patch.position = pos;

                let pSys = new BABYLON.ParticleSystem("trailSys", 100, scene);
                pSys.particleTexture = new BABYLON.Texture("assets/textures/inferno_flame_particle.png", scene);
                pSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
                let em = pSys.createCylinderEmitter(spellConfig.radius || 1.5, 0.1, 0, 0);
                em.radiusRange = 1;
                pSys.emitter = pos;
                pSys.color1 = new BABYLON.Color4(1, 0.8, 0.2, 0.9);
                pSys.color2 = new BABYLON.Color4(1, 0.2, 0.0, 0.7);
                pSys.colorDead = new BABYLON.Color4(0.5, 0, 0, 0.0);
                pSys.minSize = 0.5;
                pSys.maxSize = 1.2;
                pSys.minLifeTime = 0.3;
                pSys.maxLifeTime = 0.7;
                pSys.emitRate = 150;
                pSys.gravity = new BABYLON.Vector3(0, 3, 0);
                pSys.start();

                patches.push({ mesh: patch, pSys: pSys, pos: pos, time: 0, nextDmgTick: 500 });
            }

            if (elapsed >= duration) {
                scene.onBeforeRenderObservable.remove(dropObserver);
            }
        });

        let dmgObserver = scene.onBeforeRenderObservable.add(() => {
            let dt = scene.getEngine().getDeltaTime();
            for (let i = patches.length - 1; i >= 0; i--) {
                let p = patches[i];
                p.time += dt;

                if (p.time >= p.nextDmgTick) {
                    p.nextDmgTick += 500;
                    for (let enemy of enemies) {
                        if (enemy.isDead) continue;
                        if (BABYLON.Vector3.Distance(p.pos, enemy.mesh.position) <= (spellConfig.radius || 1.5)) {
                            applyEffectsCallback(enemy, spellConfig.effects);
                        }
                    }
                }

                if (p.time >= 3000) {
                    p.pSys.stop();
                    p.mesh.dispose();
                    setTimeout(() => p.pSys.dispose(), 1000);
                    patches.splice(i, 1);
                }
            }

            if (elapsed >= duration && patches.length === 0) {
                scene.onBeforeRenderObservable.remove(dmgObserver);
            }
        });
    },

    CONE: (scene, spellConfig, player, enemies, target, applyEffectsCallback, targetDirection) => {
        let dir = targetDirection;
        if (!dir) {
            dir = target ? target.mesh.position.subtract(player.mesh.position) : new BABYLON.Vector3(1, 0, 0);
        }
        dir.y = 0;
        dir.normalize();

        let angle = spellConfig.angle || 45; // Demi-angle
        let distance = spellConfig.distance || 8;

        // VFX: Flammes projetées dans la direction
        let particleSystem = new BABYLON.ParticleSystem("coneParticles", 500, scene);
        particleSystem.particleTexture = new BABYLON.Texture("assets/textures/fireball_flame.png", scene);
        particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;

        let emitter = particleSystem.createConeEmitter(2, Math.PI / 4); // Rayon 2, angle PI/4 (45 degrés)

        particleSystem.emitter = player.mesh.position.clone();
        particleSystem.emitter.y += 1; // Hauteur du torse

        // Orienter l'émetteur dans la direction (ConeEmitter émet par défaut vers le haut Y, il faut le tourner)
        // Mais dans Babylon, on oriente la vélocité via direction1/direction2, OU on attache à un mesh orienté.
        // Créons un mesh invisible pour orienter le ConeEmitter
        let coneMesh = BABYLON.MeshBuilder.CreateBox("coneMesh", { size: 0.1 }, scene);
        coneMesh.isVisible = false;
        coneMesh.position = particleSystem.emitter;
        // Aligner l'axe Y du mesh avec dir
        let axis1 = BABYLON.Vector3.Up();
        let axis2 = dir;
        let axis3 = BABYLON.Vector3.Cross(axis1, axis2);
        let angleRot = Math.acos(BABYLON.Vector3.Dot(axis1, axis2));
        if (axis3.lengthSquared() > 0.001) {
            axis3.normalize();
            coneMesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis3, angleRot);
        }

        particleSystem.emitter = coneMesh;

        particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0.2, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
        particleSystem.minSize = 0.5;
        particleSystem.maxSize = 2.0;
        particleSystem.minLifeTime = 0.3;
        particleSystem.maxLifeTime = 0.6;
        particleSystem.emitRate = 1500;
        particleSystem.minEmitPower = 5;
        particleSystem.maxEmitPower = 15; // Vitesse pour atteindre "distance"
        particleSystem.updateSpeed = 0.01;
        particleSystem.targetStopDuration = 0.5; // Souffle très court (0.5s)

        particleSystem.start();

        // Dégâts immédiats dans le cône
        let angleCos = Math.cos(angle * (Math.PI / 180));

        for (let enemy of enemies) {
            if (enemy.isDead) continue;

            let enemyVec = enemy.mesh.position.subtract(player.mesh.position);
            enemyVec.y = 0;
            let dist = enemyVec.length();

            if (dist <= distance) {
                enemyVec.normalize();
                let dot = BABYLON.Vector3.Dot(dir, enemyVec);
                if (dot >= angleCos) { // Dans le cône
                    applyEffectsCallback(enemy, spellConfig.effects);
                }
            }
        }

        setTimeout(() => {
            coneMesh.dispose();
            setTimeout(() => particleSystem.dispose(), 1000);
        }, 600);
    },

    INSTANT_AOE: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        let radius = spellConfig.radius || 5;

        let torus = BABYLON.MeshBuilder.CreateTorus("shockwave", { diameter: 1, thickness: 0.1, tessellation: 64 }, scene);
        torus.position = player.mesh.position.clone();
        torus.position.y += 0.5;
        let mat = new BABYLON.StandardMaterial("swMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0.8, 1, 1);
        mat.alpha = 0.8;
        mat.disableLighting = true;
        torus.material = mat;

        let scale = 1;
        let observer = scene.onBeforeRenderObservable.add(() => {
            scale += 0.5;
            torus.scaling.set(scale, 1, scale);
            mat.alpha -= 0.05;
            if (scale > radius || mat.alpha <= 0) {
                scene.onBeforeRenderObservable.remove(observer);
                torus.dispose();
            }
        });

        for (let enemy of enemies) {
            if (enemy.isDead) continue;
            let dist = BABYLON.Vector3.Distance(player.mesh.position, enemy.mesh.position);
            if (dist <= radius) {
                applyEffectsCallback(enemy, spellConfig.effects);

                let effect = spellConfig.effects.find(e => e.type === "KNOCKBACK");
                if (effect && effect.force) {
                    let dir = enemy.mesh.position.subtract(player.mesh.position);
                    dir.y = 0;
                    dir.normalize();
                    enemy.knockbackVelocity = dir.scale(effect.force / 10);
                }
            }
        }
    },

    SELF: (scene, spellConfig, player, enemies, target, applyEffectsCallback) => {
        if (spellConfig.id === "TAILWIND") {
            player.speedMultiplier = 2.0;

            let pSys = new BABYLON.ParticleSystem("tailwindSys", 100, scene);
            pSys.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
            pSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            pSys.emitter = player.mesh;
            let em = pSys.createCylinderEmitter(1, 1, 0, 0);
            em.radiusRange = 1;
            pSys.color1 = new BABYLON.Color4(0.5, 1.0, 1.0, 0.8);
            pSys.color2 = new BABYLON.Color4(0.2, 0.8, 1.0, 0.4);
            pSys.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
            pSys.minSize = 0.1;
            pSys.maxSize = 0.3;
            pSys.minLifeTime = 0.5;
            pSys.maxLifeTime = 1.0;
            pSys.emitRate = 50;
            pSys.gravity = new BABYLON.Vector3(0, 5, 0);
            pSys.start();

            let duration = spellConfig.duration * 1000;
            let start = window.gameTime;

            let observer = scene.onBeforeRenderObservable.add(() => {
                let elapsed = window.gameTime - start;
                if (elapsed > duration) {
                    player.speedMultiplier = 1.0;
                    pSys.stop();
                    setTimeout(() => pSys.dispose(), 1000);
                    scene.onBeforeRenderObservable.remove(observer);
                } else {
                    let progress = elapsed / duration;
                    player.speedMultiplier = 2.0 - progress;
                }
            });
        }
    },

    PROJECTILE_TORNADO: (scene, spellConfig, player, enemies, target, applyEffectsCallback, targetDirection) => {
        let dir = targetDirection;
        if (!dir) {
            dir = target ? target.mesh.position.subtract(player.mesh.position) : new BABYLON.Vector3(1, 0, 0);
        }
        dir.y = 0;
        dir.normalize();

        let scale = spellConfig.scale || 1;

        let tornado = BABYLON.MeshBuilder.CreateCylinder("tornado", { diameterTop: 3 * scale, diameterBottom: 0.5 * scale, height: 4 * scale }, scene);
        let mat = new BABYLON.StandardMaterial("tornMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0.5, 0.8, 1.0);
        mat.alpha = 0.2;
        mat.disableLighting = true;
        tornado.material = mat;
        tornado.isPickable = false;
        tornado.position = player.mesh.position.clone();
        tornado.position.y += 2 * scale;

        let pSys = new BABYLON.ParticleSystem("tornadoSys", 500, scene);
        pSys.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
        pSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        pSys.emitter = tornado;
        let em = pSys.createCylinderEmitter(1.5 * scale, 4 * scale, 0, 0);
        em.radiusRange = 1;
        pSys.color1 = new BABYLON.Color4(0.8, 1.0, 1.0, 0.6);
        pSys.color2 = new BABYLON.Color4(0.5, 0.8, 1.0, 0.3);
        pSys.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
        pSys.minSize = 0.5 * scale;
        pSys.maxSize = 1.5 * scale;
        pSys.minLifeTime = 0.2;
        pSys.maxLifeTime = 0.5;
        pSys.emitRate = 300;
        pSys.updateSpeed = 0.02;
        pSys.start();

        let speed = 0.15;
        let distanceTravelled = 0;
        let maxDistance = 25;
        let suckedEnemies = [];

        let animObserver = scene.onBeforeRenderObservable.add(() => {
            tornado.rotation.y += 0.5;
            let moveStep = dir.scale(speed);
            tornado.position.addInPlace(moveStep);
            distanceTravelled += speed;

            for (let enemy of enemies) {
                if (enemy.isDead || enemy.isTornadoSucked) continue;
                if (BABYLON.Vector3.Distance(tornado.position, enemy.mesh.position) < 2.5) {
                    enemy.isTornadoSucked = true;
                    enemy.mesh.isVisible = false;
                    if (enemy.hitbox) enemy.hitbox.isVisible = false;
                    suckedEnemies.push(enemy);
                }
            }

            if (distanceTravelled > maxDistance || tornado.position.y < 0) {
                scene.onBeforeRenderObservable.remove(animObserver);

                for (let enemy of suckedEnemies) {
                    if (enemy.isDead) continue;
                    enemy.isTornadoSucked = false;
                    enemy.mesh.isVisible = true;
                    if (enemy.hitbox) enemy.hitbox.isVisible = true;

                    let dropPos = tornado.position.clone();
                    dropPos.y = 1;
                    const _rng = window.rng;
                    dropPos.x += (_rng ? _rng.next() - 0.5 : Math.random() - 0.5) * 2;
                    dropPos.z += (_rng ? _rng.next() - 0.5 : Math.random() - 0.5) * 2;
                    enemy.mesh.position = dropPos;

                    applyEffectsCallback(enemy, spellConfig.effects);
                }

                pSys.stop();
                setTimeout(() => pSys.dispose(), 1000);
                tornado.dispose();
            }
        });
    },

    PROJECTILE_SINGLE: (scene, spellConfig, player, enemies, target, applyEffectsCallback, targetDirection) => {
        let direction = targetDirection;
        if (!direction) {
            direction = target ? target.mesh.position.subtract(player.mesh.position) : new BABYLON.Vector3(1, 0, 0);
        }
        direction.y = 0;
        direction.normalize();

        let projectilesCount = spellConfig.projectiles || 1;

        let spawnProjectile = (dirOffsetAngle) => {
            let dir = direction.clone();
            if (dirOffsetAngle !== 0) {
                let matrix = BABYLON.Matrix.RotationY(dirOffsetAngle);
                dir = BABYLON.Vector3.TransformCoordinates(dir, matrix);
            }

        let bladePath = [];
        for (let i = 0; i <= 16; i++) {
            let a = (i / 16) * Math.PI; 
            bladePath.push(new BABYLON.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
        let blade = BABYLON.MeshBuilder.CreateTube("blade", { path: bladePath, radius: 0.05, tessellation: 16 }, scene);
        blade.scaling.z = 0.5;

        let axis1 = BABYLON.Vector3.Forward();
        let axis2 = dir;
        let axis3 = BABYLON.Vector3.Cross(axis1, axis2);
        let angleRot = Math.acos(BABYLON.Vector3.Dot(axis1, axis2));
        if (axis3.lengthSquared() > 0.001) {
            axis3.normalize();
            blade.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis3, angleRot);
        } else if (BABYLON.Vector3.Dot(axis1, axis2) < 0) {
            blade.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), Math.PI);
        }

        let mat = new BABYLON.StandardMaterial("bladeMat", scene);
        mat.emissiveColor = new BABYLON.Color3(0.6, 1.0, 0.8);
        mat.alpha = 0.8;
        mat.disableLighting = true;
        blade.material = mat;
        blade.isPickable = false;
        blade.position = player.mesh.position.clone();
        blade.position.y += 1;

        let speed = 0.4;
        let frame = 0;

        let animObserver = scene.onBeforeRenderObservable.add(() => {
            frame++;
            if (frame > 150) {
                scene.onBeforeRenderObservable.remove(animObserver);
                blade.dispose();
                return;
            }

            blade.position.addInPlace(dir.scale(speed));

            let hitEnemy = null;
            for (let enemy of enemies) {
                if (enemy.isDead) continue;
                if (BABYLON.Vector3.Distance(blade.position, enemy.mesh.position) < 1.5) {
                    hitEnemy = enemy;
                    break;
                }
            }

            if (hitEnemy) {
                applyEffectsCallback(hitEnemy, spellConfig.effects);

                let effect = spellConfig.effects.find(e => e.type === "KNOCKBACK");
                if (effect && effect.force) {
                    let kDir = dir.clone();
                    hitEnemy.knockbackVelocity = kDir.scale(effect.force / 10);
                }

                scene.onBeforeRenderObservable.remove(animObserver);
                blade.dispose();
            }
        });
        };

        if (projectilesCount === 1) {
            spawnProjectile(0);
        } else {
            let spreadAngle = (15 * (projectilesCount - 1)) * (Math.PI / 180);
            let startAngle = -spreadAngle / 2;
            let stepAngle = spreadAngle / Math.max(1, projectilesCount - 1);

            for (let i = 0; i < projectilesCount; i++) {
                spawnProjectile(startAngle + (stepAngle * i));
            }
        }
    }
};
