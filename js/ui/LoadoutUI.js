import { ElementDatabase } from '../configs/ElementDatabase.js';
import { RuneDatabase } from '../configs/RuneDatabase.js';
import { SpellDatabase } from '../configs/SpellDatabase.js';
import { loadoutManager } from '../managers/LoadoutManager.js';

export class LoadoutUI {
    constructor() {
        this.domElements = {
            screen: document.getElementById('loadoutScreen'),
            equippedContainer: document.querySelector('.equipped-elements-container'),
            runeGrid: document.getElementById('runeGrid'),
            astrolabeView: document.getElementById('astrolabeView'),
            astrolabeGraph: document.getElementById('astrolabeGraph'),
            detailView: document.getElementById('elementDetailView'),
            btnBack: document.getElementById('btnBackToAstrolabe'),
            btnEquip: document.getElementById('btnEquipElement'),
            detailName: document.getElementById('detailElementName'),
            spellsList: document.getElementById('elementSpellsList')
        };

        this.currentSelectedElement = null;

        this.initUI();
        this.bindEvents();
    }

    initUI() {
        if (!this.domElements.screen) return;
        this.renderRuneGrid();
        this.renderAstrolabe();
        this.updateEquippedElementsView();
    }

    renderRuneGrid() {
        this.domElements.runeGrid.innerHTML = '';
        Object.values(RuneDatabase).forEach(rune => {
            const slot = document.createElement('div');
            slot.className = 'rune-slot';
            slot.dataset.runeId = rune.id;
            
            const traceImage = document.createElement('img');
            traceImage.src = `assets/symbols/${rune.traceIcon}`;
            traceImage.className = 'rune-trace-image';
            slot.appendChild(traceImage);
            
            // Container pour l'icône du sort si assigné
            const iconContainer = document.createElement('div');
            iconContainer.className = 'spell-icon-container';
            slot.appendChild(iconContainer);

            // Drag Events
            slot.addEventListener('dragover', (e) => {
                e.preventDefault(); // Autorise le drop
                slot.classList.add('drag-hover');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-hover');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-hover');
                const spellId = e.dataTransfer.getData('text/plain');
                if (spellId) {
                    this.handleSpellDrop(spellId, rune.id);
                }
            });

            this.domElements.runeGrid.appendChild(slot);
        });
    }

    renderAstrolabe() {
        this.domElements.astrolabeGraph.innerHTML = '';
        
        // Configuration des rayons et angles
        const astrolabeConfig = {
            // 1er Cercle (Eléments Primordiaux)
            FIRE:      { r: 80, angle: -Math.PI / 2 },
            AIR:       { r: 80, angle: 0 },
            WATER:     { r: 80, angle: Math.PI / 2 },
            EARTH:     { r: 80, angle: Math.PI },

            // 2e Cercle (Eléments Combinés)
            LIGHTNING: { r: 160, angle: -Math.PI / 4 },    // Feu + Air
            ICE:       { r: 160, angle: Math.PI / 4 },     // Eau + Air
            POISON:    { r: 160, angle: 3 * Math.PI / 4 }, // Terre + Eau
            MAGMA:     { r: 160, angle: -3 * Math.PI / 4 },// Feu + Terre

            // 3e Cercle (Eléments Esotériques)
            TIME:      { r: 240, angle: -Math.PI / 2 },
            LIGHT:     { r: 240, angle: 0 },
            SPACE:     { r: 240, angle: Math.PI / 2 },
            VOID:      { r: 240, angle: Math.PI }
        };

        const connections = [
            ['FIRE', 'LIGHTNING'], ['AIR', 'LIGHTNING'],
            ['AIR', 'ICE'], ['WATER', 'ICE'],
            ['WATER', 'POISON'], ['EARTH', 'POISON'],
            ['EARTH', 'MAGMA'], ['FIRE', 'MAGMA']
        ];

        // --- DESSIN DU FOND (CERCLES ET LIGNES) EN SVG ---
        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.style.position = 'absolute';
        svg.style.top = '50%';
        svg.style.left = '50%';
        svg.style.transform = 'translate(-50%, -50%)';
        svg.setAttribute('width', '600');
        svg.setAttribute('height', '600');
        svg.setAttribute('viewBox', '-300 -300 600 600');
        svg.style.zIndex = '0';
        svg.style.pointerEvents = 'none';

        // Helper pour récupérer les coordonnées SVG
        const getCoords = (id) => {
            const conf = astrolabeConfig[id];
            if (!conf) return { x: 0, y: 0 };
            return {
                x: Math.cos(conf.angle) * conf.r,
                y: Math.sin(conf.angle) * conf.r
            };
        };

        // Dessiner les 3 cercles d'orbite
        [80, 160, 240].forEach(r => {
            const circle = document.createElementNS(svgNs, "circle");
            circle.setAttribute("cx", "0");
            circle.setAttribute("cy", "0");
            circle.setAttribute("r", r.toString());
            circle.setAttribute("stroke", "rgba(255, 255, 255, 0.15)");
            circle.setAttribute("stroke-width", "2");
            circle.setAttribute("fill", "none");
            circle.setAttribute("stroke-dasharray", "4, 6");
            svg.appendChild(circle);
        });

        // Dessiner les connexions entre éléments
        connections.forEach(conn => {
            const p1 = getCoords(conn[0]);
            const p2 = getCoords(conn[1]);
            const line = document.createElementNS(svgNs, "line");
            line.setAttribute("x1", p1.x);
            line.setAttribute("y1", p1.y);
            line.setAttribute("x2", p2.x);
            line.setAttribute("y2", p2.y);
            line.setAttribute("stroke", "rgba(255, 255, 255, 0.4)");
            line.setAttribute("stroke-width", "2");
            svg.appendChild(line);
        });

        this.domElements.astrolabeGraph.appendChild(svg);

        // --- PLACEMENT DES NOEUDS HTML ---
        Object.values(ElementDatabase).forEach(element => {
            const conf = astrolabeConfig[element.id];
            if (!conf) return; // Ignore elements not configured

            const pos = getCoords(element.id);
            const isPrimordial = ["FIRE", "AIR"].includes(element.id);

            const node = document.createElement('div');
            node.className = 'astrolabe-node' + (isPrimordial ? '' : ' locked');
            node.style.borderColor = isPrimordial ? element.color : '#444';
            node.style.boxShadow = isPrimordial ? `0 0 15px ${element.color}, inset 0 0 10px ${element.color}` : 'none';
            node.style.color = isPrimordial ? '#fff' : '#666';
            node.style.zIndex = '1';
            
            const icon = document.createElement('img');
            icon.src = `assets/elements/${element.id.toLowerCase()}.png`;
            icon.style.width = '70%';
            icon.style.height = '70%';
            icon.style.objectFit = 'contain';
            if (!isPrimordial) {
                icon.style.filter = 'grayscale(100%) opacity(0.5)';
            }
            node.appendChild(icon);
            
            node.style.left = `calc(50% + ${pos.x}px - 35px)`; // 35px = moitié de 70px
            node.style.top = `calc(50% + ${pos.y}px - 35px)`;

            if (isPrimordial) {
                node.addEventListener('click', () => {
                    this.openDetailView(element);
                });
            } else {
                node.title = "Coming soon...";
            }

            this.domElements.astrolabeGraph.appendChild(node);
        });
    }

    openDetailView(element) {
        this.currentSelectedElement = element;
        this.domElements.astrolabeView.classList.add('hidden');
        this.domElements.astrolabeView.classList.remove('view-active');
        
        this.domElements.detailView.classList.remove('hidden');
        this.domElements.detailView.classList.add('view-active');

        this.domElements.detailName.innerText = element.name.toUpperCase();
        this.domElements.detailName.style.color = element.color;
        this.domElements.detailName.style.textShadow = `0 0 10px ${element.color}`;

        this.updateEquipButtonState();
        this.renderSpellsList(element);
    }

    updateEquipButtonState() {
        if (!this.currentSelectedElement) return;

        const isEquipped = loadoutManager.equippedElements.has(this.currentSelectedElement.id);
        const isFull = loadoutManager.equippedElements.size >= loadoutManager.maxElements;

        if (isEquipped) {
            this.domElements.btnEquip.innerText = "UNEQUIP";
            this.domElements.btnEquip.style.background = "#555";
            this.domElements.btnEquip.disabled = false;
        } else if (isFull) {
            this.domElements.btnEquip.innerText = "SLOTS FULL";
            this.domElements.btnEquip.style.background = "#222";
            this.domElements.btnEquip.disabled = true;
        } else {
            this.domElements.btnEquip.innerText = "EQUIP THIS ELEMENT";
            this.domElements.btnEquip.style.background = ""; // Reset
            this.domElements.btnEquip.disabled = false;
        }
    }

    renderSpellsList(element) {
        this.domElements.spellsList.innerHTML = '';
        const isEquipped = loadoutManager.equippedElements.has(element.id);

        Object.values(SpellDatabase).forEach(spell => {
            if (spell.element === element.id) {
                const card = document.createElement('div');
                card.className = `spell-card ${!isEquipped ? 'disabled' : ''}`;
                card.draggable = isEquipped; // Autorise le drag uniquement si équipé
                
                card.innerHTML = `
                    <div class="spell-card-icon">
                        ${spell.icon && spell.icon.endsWith('.png') 
                            ? `<img src="${spell.icon}" style="width:100%; height:100%; object-fit:contain;">` 
                            : (spell.icon || '✨')}
                    </div>
                    <div class="spell-card-name" style="color: ${element.color}">${spell.name}</div>
                    <div class="spell-card-desc">${spell.desc || ''}</div>
                `;

                if (isEquipped) {
                    card.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', spell.id);
                        document.body.classList.add('is-dragging-spell');
                    });
                    
                    card.addEventListener('dragend', () => {
                        document.body.classList.remove('is-dragging-spell');
                    });
                }

                this.domElements.spellsList.appendChild(card);
            }
        });
    }

    bindEvents() {
        if (!this.domElements.screen) return;

        this.domElements.btnBack.addEventListener('click', () => {
            this.domElements.detailView.classList.add('hidden');
            this.domElements.detailView.classList.remove('view-active');
            
            this.domElements.astrolabeView.classList.remove('hidden');
            this.domElements.astrolabeView.classList.add('view-active');
        });

        this.domElements.btnEquip.addEventListener('click', () => {
            if (!this.currentSelectedElement) return;

            const isEquipped = loadoutManager.equippedElements.has(this.currentSelectedElement.id);
            if (isEquipped) {
                loadoutManager.unequipElement(this.currentSelectedElement.id);
            } else {
                loadoutManager.equipElement(this.currentSelectedElement.id);
            }
            
            this.updateEquipButtonState();
            this.updateEquippedElementsView();
            this.renderSpellsList(this.currentSelectedElement); // Refresh drag state
            this.updateRuneGridVisuals(); // Enleve les icônes des sorts si déséquipé
            if (window.updateActiveBindingsHub) window.updateActiveBindingsHub();
        });
    }

    updateEquippedElementsView() {
        const slots = Array.from(this.domElements.equippedContainer.children);
        const equippedArr = loadoutManager.getEquippedElements();

        slots.forEach((slot, index) => {
            slot.className = 'element-slot'; // Reset
            slot.innerHTML = '';
            slot.style.color = '';

            if (index < equippedArr.length) {
                const el = equippedArr[index];
                slot.classList.add('filled');
                slot.style.color = el.color;
                const icon = document.createElement('img');
                icon.src = `assets/elements/${el.id.toLowerCase()}.png`;
                icon.style.width = '70%';
                icon.style.height = '70%';
                icon.style.objectFit = 'contain';
                slot.appendChild(icon);
            }
        });
    }

    handleSpellDrop(spellId, runeId) {
        const success = loadoutManager.assignSpellToRune(spellId, runeId);
        if (success) {
            this.updateRuneGridVisuals();
            if (window.updateActiveBindingsHub) window.updateActiveBindingsHub();
        }
    }

    updateRuneGridVisuals() {
        const slots = Array.from(this.domElements.runeGrid.children);
        slots.forEach(slot => {
            const runeId = slot.dataset.runeId;
            const spell = loadoutManager.getSpellsForRune(runeId);
            const iconContainer = slot.querySelector('.spell-icon-container');
            
            if (spell) {
                iconContainer.innerHTML = spell.icon && spell.icon.endsWith('.png')
                    ? `<img src="${spell.icon}" style="width:100%; height:100%; object-fit:contain;">`
                    : (spell.icon || '✨');
                slot.style.color = ElementDatabase[spell.element].color;
            } else {
                iconContainer.innerHTML = '';
                slot.style.color = ''; // Reset CSS
            }
        });
    }

    show() {
        if (this.domElements.screen) this.domElements.screen.classList.remove('hidden');
    }

    hide() {
        if (this.domElements.screen) this.domElements.screen.classList.add('hidden');
        if (window.saveGameData && window.sceneManager && window.sceneManager.sharedState) {
            window.saveGameData(window.sceneManager.sharedState.selectedCharacterName);
        }
    }
}
