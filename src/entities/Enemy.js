export class Enemy {
    constructor(scene, playerPos, radius, color = new BABYLON.Color3(1, 0, 0)) {
        this.scene = scene;
        this.hp = 100;
        this.speed = 0.07;
        this.damage = 10;
        this.experienceValue = 5;
        this.lastDamageTime = 0;
        this.damageCooldown = 1000; // 1s cooldown for dealing damage
        
        this.mesh = BABYLON.MeshBuilder.CreateCapsule("enemy", {height: 2, radius: 0.5}, scene);
        const mat = new BABYLON.StandardMaterial("enemyMat", scene);
        mat.diffuseColor = color;
        this.mesh.material = mat;
        
        const angle = Math.random() * Math.PI * 2;
        this.mesh.position.x = playerPos.x + Math.cos(angle) * radius;
        this.mesh.position.z = playerPos.z + Math.sin(angle) * radius;
        this.mesh.position.y = 1;
        this.isDead = false;
        this.deathPosition = null;
        
        this.freezeEndTime = 0;
        this.slowEndTime = 0;
    }

    applyFreeze(durationMs) {
        this.freezeEndTime = Math.max(this.freezeEndTime, window.gameTime + durationMs);
        this.showFloatingText("FREEZED", "#44ccff");
    }

    applySlow(durationMs) {
        this.slowEndTime = Math.max(this.slowEndTime, window.gameTime + durationMs);
        this.showFloatingText("SLOWED", "#d2691e");
    }

    heal(amount) {
        this.hp += amount;
        this.showFloatingText("+" + amount, "#44ff44");
        // Optionally cap at max hp if you prefer, but requirement just says this.hp += amount
    }

    update(player, enemies) {
        if (this.isDead || player.isDead) return;

        let currentTime = window.gameTime;
        
        if (currentTime < this.freezeEndTime) {
            return; // Cannot move or attack while frozen
        }

        const distance = BABYLON.Vector3.Distance(this.mesh.position, player.mesh.position);
        
        // Collision detection for damaging the player
        if (distance < 1.0 || this.mesh.intersectsMesh(player.mesh, false)) {
            if (currentTime - this.lastDamageTime >= this.damageCooldown) {
                player.takeDamage(this.damage);
                this.lastDamageTime = currentTime;
            }
        }

        // Separation force
        let separation = new BABYLON.Vector3(0, 0, 0);
        if (enemies) {
            for (let other of enemies) {
                if (other === this || other.isDead) continue;
                let d = BABYLON.Vector3.Distance(this.mesh.position, other.mesh.position);
                if (d > 0 && d < 1.5) {
                    let push = this.mesh.position.subtract(other.mesh.position);
                    push.normalize();
                    push.scaleInPlace((1.5 - d) * 0.1); 
                    separation.addInPlace(push);
                }
            }
        }

        const direction = player.mesh.position.subtract(this.mesh.position);
        direction.y = 0;
        if (direction.length() > 0.1) {
            direction.normalize();
            
            let currentSpeed = this.speed;
            if (currentTime < this.slowEndTime) {
                currentSpeed *= 0.5; // slow down by half
            }

            let moveVec = direction.scale(currentSpeed);
            moveVec.addInPlace(separation);
            
            this.mesh.position.addInPlace(moveVec);
        }
    }
    
    takeDamage(amount) {
        if (amount > 0) {
            this.hp -= amount;
            this.showFloatingText("-" + amount, "#ff4444");
        }
        if (this.hp <= 0) {
            this.die();
        }
    }
    
    showFloatingText(text, colorString) {
        if (this.isDead || !this.mesh) return;

        const scene = this.scene;
        const plane = BABYLON.MeshBuilder.CreatePlane("floatingText", {width: 2, height: 1}, scene);
        plane.position = this.mesh.position.clone();
        plane.position.y += 2;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const dynTexture = new BABYLON.DynamicTexture("dynamic texture", {width:512, height:256}, scene, true);
        dynTexture.hasAlpha = true;
        
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.emissiveTexture = dynTexture;
        mat.diffuseTexture = dynTexture;
        mat.opacityTexture = dynTexture;
        mat.disableLighting = true;
        mat.backFaceCulling = false;
        plane.material = mat;

        const ctx = dynTexture.getContext();
        ctx.clearRect(0, 0, 512, 256);
        ctx.font = "bold 60px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = colorString;
        ctx.fillText(text, 256, 128);
        dynTexture.update();

        const duration = 1000;
        const startTime = performance.now();
        const startY = plane.position.y;
        
        const observer = scene.onBeforeRenderObservable.add(() => {
            let elapsed = performance.now() - startTime;
            if (elapsed > duration) {
                scene.onBeforeRenderObservable.remove(observer);
                plane.dispose();
                mat.dispose();
                dynTexture.dispose();
            } else {
                let progress = elapsed / duration;
                plane.position.y = startY + progress * 2;
                mat.alpha = 1.0 - progress;
            }
        });
    }

    die() {
        this.isDead = true;
        this.deathPosition = this.mesh.position.clone();
        this.mesh.dispose();
    }
}
