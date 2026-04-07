// Remarque : Avec le type="module" natif du navigateur, il faut obligatoirement mettre ".js" à la fin des imports
import { Environment } from './level/Environment.js';
import { Player } from './entities/Player.js';
import { CameraManager } from './managers/CameraManager.js';
import { InputManager } from './managers/InputManager.js';
import { FireEnemy, IceEnemy, EarthEnemy } from './entities/ElementalEnemies.js';
import { XpOrb } from './entities/XpOrb.js';
import { SpellManager } from './managers/SpellManager.js';
import { SpellDatabase } from './configs/SpellDatabase.js';
import { WaveManager } from './managers/WaveManager.js';

// 1. Initialisation du moteur
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

// 2. Instanciation de nos classes
const environment = new Environment(scene);
const player = new Player(scene);
const cameraManager = new CameraManager(scene);
const spellManager = new SpellManager(scene);
const waveManager = new WaveManager();

const inputManager = new InputManager();

// On connecte la caméra au joueur
cameraManager.setTarget(player.mesh);

const enemies = [];
const xpOrbs = [];
const enemySpawnRate = 2000; // ms
let lastSpawnTime = 0;

window.isGamePaused = true;

// Drag and Drop Logic
const spellBank = document.getElementById('spellBank');
const slots = {
    'KeyQ': document.getElementById('slot-earth'),
    'KeyE': document.getElementById('slot-ice'),
    'KeyF': document.getElementById('slot-fire')
};
const hudSlots = {
    'KeyQ': document.getElementById('hud-q'),
    'KeyE': document.getElementById('hud-e'),
    'KeyF': document.getElementById('hud-f')
};
const startGameBtn = document.getElementById('startGameBtn');
const spellSelectionScreen = document.getElementById('spellSelectionScreen');

// Populate spell bank
Object.values(SpellDatabase).forEach(spell => {
    const spellEl = document.createElement('div');
    spellEl.className = 'spell-item';
    spellEl.draggable = true;
    spellEl.dataset.spellId = spell.id;
    spellEl.innerText = spell.name;
    
    spellEl.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', spell.id);
    });
    
    spellBank.appendChild(spellEl);
});

function checkAllSlotsFilled() {
    const allFilled = Object.values(slots).every(slot => slot.children.length > 0);
    startGameBtn.style.display = allFilled ? 'block' : 'none';
}

Object.values(slots).forEach(slot => {
    slot.addEventListener('dragover', e => {
        e.preventDefault();
    });
    
    slot.addEventListener('drop', e => {
        e.preventDefault();
        
        if (slot.children.length > 0) return; // Prevent dropping if slot is occupied
        
        const spellId = e.dataTransfer.getData('text/plain');
        if (!spellId) return;
        
        const spellConfig = SpellDatabase[spellId];
        if (!spellConfig || !spellConfig.effects) return;
        
        const damageEffect = spellConfig.effects.find(eff => eff.type === 'DAMAGE');
        if (!damageEffect) return;
        
        const spellElement = damageEffect.element;
        
        // Strict assignment based on element
        if (slot.id === 'slot-earth' && spellElement !== 'EARTH') return;
        if (slot.id === 'slot-fire' && spellElement !== 'FIRE') return;
        if (slot.id === 'slot-ice' && spellElement !== 'ICE') return;
        
        const draggedEl = document.querySelector(`.spell-item[data-spell-id="${spellId}"]`);
        if (draggedEl) {
            const clone = draggedEl.cloneNode(true);
            clone.draggable = true; // allow dragging out of slot if needed
            clone.addEventListener('dragstart', dragEvent => {
                dragEvent.dataTransfer.setData('text/plain', spellId);
                setTimeout(() => clone.remove(), 0); // remove after starting drag
                setTimeout(checkAllSlotsFilled, 10);
            });
            slot.appendChild(clone);
            checkAllSlotsFilled();
        }
    });
});

spellBank.addEventListener('dragover', e => e.preventDefault());
spellBank.addEventListener('drop', e => {
    e.preventDefault();
    // Allow dropping back to bank (we just do nothing as it's a clone in the slot that got removed)
    checkAllSlotsFilled();
});

let activeBindings = [];

startGameBtn.addEventListener('click', () => {
    activeBindings = [
        { key: 'KeyQ', spellCode: Object.values(SpellDatabase).find(s => s.id === slots['KeyQ'].children[0].dataset.spellId) },
        { key: 'KeyE', spellCode: Object.values(SpellDatabase).find(s => s.id === slots['KeyE'].children[0].dataset.spellId) },
        { key: 'KeyF', spellCode: Object.values(SpellDatabase).find(s => s.id === slots['KeyF'].children[0].dataset.spellId) }
    ];
    window.activeSpellIds = activeBindings.map(b => b.spellCode.id);
    
    spellManager.bindSpells(activeBindings);
    spellSelectionScreen.style.display = 'none';
    window.isGamePaused = false;
    
    // Set HUD names
    activeBindings.forEach(binding => {
        const hudSlot = hudSlots[binding.key];
        const nameEl = hudSlot.querySelector('.hud-spell-name');
        nameEl.innerText = binding.spellCode.name;
        // Reset color or any specific styling if needed
    });
});

window.gameTime = 0;
let lastRealTime = performance.now();

// 3. La boucle de Gameplay (Game Loop)
// Ce code s'exécute environ 60 fois par seconde
engine.runRenderLoop(() => {
    let currentRealTime = performance.now();
    let dt = currentRealTime - lastRealTime;
    lastRealTime = currentRealTime;

    if (!window.isGamePaused) {
        window.gameTime += dt;
    }
    
    let currentTime = window.gameTime;
    
    if (!window.isGamePaused) {
        // Spawn enemies
        if (currentTime - lastSpawnTime >= enemySpawnRate) {
            let spawnDistance = 20 + Math.random() * 10; // 20 to 30 units
            
            // On utilise WaveManager (le directeur d'IA)
            let enemyType = waveManager.spawnEnemy(player);
            
            let newEnemy;
            if (enemyType === 'FIRE') newEnemy = new FireEnemy(scene, player.mesh.position, spawnDistance);
            else if (enemyType === 'ICE') newEnemy = new IceEnemy(scene, player.mesh.position, spawnDistance);
            else newEnemy = new EarthEnemy(scene, player.mesh.position, spawnDistance);
            
            enemies.push(newEnemy);
            lastSpawnTime = currentTime;
        }

        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            enemy.update(player, enemies);
            if (enemy.isDead) {
                // Check if there is a death position to spawn XP orb
                if (enemy.deathPosition) {
                    xpOrbs.push(new XpOrb(scene, enemy.deathPosition, enemy.experienceValue));
                }
                enemies.splice(i, 1);
            }
        }

        // Update XP Orbs
        for (let i = xpOrbs.length - 1; i >= 0; i--) {
            let orb = xpOrbs[i];
            orb.update(player);
            if (orb.isDestroyed) {
                xpOrbs.splice(i, 1);
            }
        }

        player.update(inputManager, enemies);
        spellManager.update(inputManager, player, enemies);
        cameraManager.update();
        
        // Update HUD cooldowns
        activeBindings.forEach(binding => {
            const key = binding.key;
            const spellId = binding.spellCode.id;
            
            const cooldownMs = binding.spellCode.cooldown * 1000;
            const lastTime = spellManager.cooldowns[spellId] || 0;
            const elapsed = currentTime - lastTime;
            
            let angle = 0;
            if (elapsed < cooldownMs) {
                const progress = elapsed / cooldownMs;
                angle = progress * 360;
            } else {
                angle = 360;
            }
            
            const needle = hudSlots[key].querySelector('.hud-needle');
            if (needle) {
                needle.style.transform = `rotate(${angle}deg)`;
            }
        });

        // Update AI probabilities UI
        const probs = waveManager.getSpawnProbabilities(player);
        const pctFire = Math.round((probs.FIRE / probs.totalWeight) * 100);
        const pctIce = Math.round((probs.ICE / probs.totalWeight) * 100);
        const pctEarth = Math.round((probs.EARTH / probs.totalWeight) * 100);

        const elFire = document.getElementById("probFire");
        const elIce = document.getElementById("probIce");
        const elEarth = document.getElementById("probEarth");
        
        if (elFire) elFire.innerText = `Fire: ${pctFire}%`;
        if (elIce) elIce.innerText = `Ice: ${pctIce}%`;
        if (elEarth) elEarth.innerText = `Earth: ${pctEarth}%`;
    }
    
    scene.render();
});

// 4. Gestion du redimensionnement de la fenêtre
window.addEventListener("resize", () => {
    engine.resize();
});