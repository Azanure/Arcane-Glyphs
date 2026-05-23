# Arcane Glyphs — Games on Web 2025

**Équipe :** Cazacu Ion, Virgile Lassagne, Sofiane
**Vidéo Explicative:** https://www.youtube.com/watch?v=GPQWP5VItwQ
---

## Le thème : L'IA

Le thème du concours est "l'IA" — et on l'a pris au pied de la lettre, mais pas de la façon la plus évidente.

Dans Arcane Glyphs, **vous êtes un mage qui combat des vagues d'ennemis**.

La couche du thème : **vous interagissez avec le jeu via une IA de vision** (MediaPipe Hands). Pas de souris, pas de clavier pour lancer des sorts — vous pincez l'index et le pouce devant la caméra et dessinez des formes dans l'air.

---

## Comment jouer

> ⚠️ **Ce jeu nécessite une webcam.** Il n'est pas jouable sur mobile ni sur tablette.  
> Pas besoin de souris pour les sorts — c'est votre main qui fait le boulot.

**Hub (menu de préparation) :** utilisez la souris normalement pour naviguer, choisir votre personnage et équiper vos sorts.

**En jeu :**
- **Déplacement :** WASD ou ZQSD selon votre clavier
- **Sorts :** placez votre main devant la caméra, **pincez** (index + pouce) et dessinez une forme. Relâchez pour lancer le sort correspondant

---

## Difficultés & galères

### La reconnaissance de formes
C'est le cœur du gameplay et de loin le truc le plus chiant à faire. On a implémenté l'algorithme $1 Unistroke Recognizer et fait des dizaines de templates pour couvrir toutes les façons naturelles de dessiner un cercle, un triangle, un V... Le résultat est correct mais pas parfait — un tracé mal orienté ou trop rapide peut être mal reconnu. C'est une limite qu'on assume.

### Les VFX
Babylon.js a un système de particules puissant mais avec une courbe d'apprentissage bien raide. On a passé beaucoup de temps à tuner les VFX pour que ça ressemble à quelque chose — les lames de vent, les tornades, les zones de feu... Chaque sort a son propre système de particules. Certains sont réussis, d'autres on a fait avec les moyens du bord.

### Le game feel : ni trop facile, ni trop dur
Equilibrer les dégâts, les cooldowns, le nombre d'ennemis par vague, la vitesse de spawn... c'est un travail itératif sans fin. On a essayé d'arriver à quelque chose qui se joue bien sans être frustrant, mais l'équilibre est encore fragile.

### Les assets
Trouver des modèles 3D gratuits qui s'intègrent bien ensemble et correspondent à l'univers du jeu, c'est sous-estimé. On a fini par utiliser des champions de League of Legends (Brand, Azir) parce que leurs kits collaient parfaitement au concept.

### Les performances & collisions
Babylon.js + MediaPipe en simultané sur un seul thread, c'est lourd. Les performances ne sont pas terribles, surtout sur des machines sans carte graphique dédiée. Les collisions aussi nous ont donné du fil à retordre — les hitboxes ne sont pas toujours très fidèles.

---

## Ce dont on est fiers

- Le système de sorts entièrement basé sur des gestes à la main, ça marche et c'est fun
- L'intégration MediaPipe → Babylon.js sans aucune librairie tierce entre les deux
- Les sorts d'air (Wind Blades, Tornade, Squall, Slow Zone, Tailwind) avec des VFX
- Le système de grimoire pour équiper ses sorts avant chaque partie

---

## Stack technique

- **Babylon.js** — moteur 3D WebGL
- **MediaPipe Hands** — tracking de la main via webcam
- **$1 Unistroke Recognizer** — algorithme de reconnaissance de gestes
- Vanilla JS, HTML, CSS — pas de framework