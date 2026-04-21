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
            slot.dataset.trace = rune.traceIcon;
            
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
        
        // Distribution basique en cercle pour le prototype graphique
        const elements = Object.values(ElementDatabase);
        const radius = 150;
        const centerX = 200; // Demi taille estimée du conteneur
        const centerY = 200;

        elements.forEach((element, index) => {
            const angle = (index / elements.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const node = document.createElement('div');
            node.className = 'astrolabe-node';
            node.style.borderColor = element.color;
            node.style.boxShadow = `0 0 10px ${element.color}`;
            
            // Prendre la première lettre ou un icône par défaut
            node.innerText = element.name.substring(0, 2).toUpperCase();
            
            // Positionnement
            node.style.left = `calc(50% + ${x}px - 35px)`; // 35px = moitié de 70px (width)
            node.style.top = `calc(50% + ${y}px - 35px)`;

            node.addEventListener('click', () => {
                this.openDetailView(element);
            });

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
            this.domElements.btnEquip.innerText = "DÉSÉQUIPER";
            this.domElements.btnEquip.style.background = "#555";
            this.domElements.btnEquip.disabled = false;
        } else if (isFull) {
            this.domElements.btnEquip.innerText = "SLOTS PLEINS";
            this.domElements.btnEquip.style.background = "#222";
            this.domElements.btnEquip.disabled = true;
        } else {
            this.domElements.btnEquip.innerText = "ÉQUIPER CET ÉLÉMENT";
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
                    <div class="spell-card-icon">${spell.icon || '✨'}</div>
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
                slot.innerText = el.name.substring(0, 2).toUpperCase(); // Placeholder
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
                iconContainer.innerHTML = spell.icon || '✨';
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
    }
}
