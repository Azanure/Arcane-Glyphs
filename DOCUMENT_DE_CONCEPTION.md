# Document de Conception : Arcane Glyphs

## 1. Vision et Interprétation du Thème
Le thème imposé pour cette édition de Games on Web est l'« IA ». Notre parti pris a été d'intégrer l'IA non seulement comme un élément narratif ou un adversaire *in-game*, mais surtout comme le cœur même de l'interaction homme-machine (IHM). 

Au lieu d'utiliser un combo clavier/souris classique pour déclencher des capacités, nous avons décidé de contraindre le joueur à "incanter" ses sorts physiquement devant sa webcam. L'IA n'est donc pas seulement ce qu'on affronte (via les systèmes de vagues et les comportements adaptatifs des ennemis), c'est l'outil indispensable qui traduit les gestes du joueur en actions dans le jeu.

## 2. Architecture Technique et Choix Technologiques
Afin de garantir un accès universel depuis le navigateur, nous avons opté pour une architecture entièrement web, *client-side*, sans serveur dédié pour la logique de jeu.

*   **Moteur 3D : Babylon.js**. Choisi pour sa robustesse, sa documentation exhaustive et ses capacités avancées de gestion de particules (indispensables pour un jeu basé sur la magie).
*   **Vision par Ordinateur : MediaPipe Hands (Google)**. Modèle de machine learning exécuté directement dans le navigateur via WebGL/WebAssembly. Il permet de tracker 21 points d'articulation de la main en temps réel.
*   **Reconnaissance de Formes : Algorithme $1 Unistroke Recognizer**. Implémenté en JavaScript pur pour analyser et classifier les tracés générés par le tracking de la main.
*   **UI et DOM :** Interactions hybrides combinant un canvas WebGL (Babylon) et une surcouche HTML/CSS standard pour les menus (Hub, Astrolabe des sorts).

## 3. Algorithmes et IA Intégrées

### 3.1 Tracking de la Main (MediaPipe)
L'intégration de MediaPipe s'est avérée particulièrement complexe en raison du besoin de synchronisation avec la boucle de rendu de Babylon.js. 
Nous avons extrait les coordonnées des points de repère (landmarks) de l'index et du pouce. Pour déclencher le tracé d'un sort, nous calculons la distance euclidienne entre ces deux points. Si elle passe sous un certain seuil, le système considère qu'il y a "pincement" (pinch) et commence à enregistrer un vecteur de points 2D. 
Un filtre de lissage (Interpolation Linéaire - LERP) a été appliqué sur les coordonnées brutes pour éviter le *jittering* (tremblement) naturel de la main et de la caméra, assurant un tracé fluide.

### 3.2 Reconnaissance de Formes ($1 Unistroke)
C'est le défi algorithmique majeur du projet. Une fois le tracé terminé (relâchement du pincement), la liste des points bruts est traitée par le `$1 Unistroke Recognizer` :
1.  **Rééchantillonnage (Resampling) :** Le tracé est divisé en $N$ points équidistants pour normaliser la vitesse d'exécution du geste.
2.  **Rotation (Indicative Angle) :** Le tracé est tourné pour s'aligner sur un axe de référence (basé sur le centre de gravité).
3.  **Mise à l'échelle (Scaling) :** Le motif est redimensionné dans une *bounding box* standard.
4.  **Translation :** Le motif est centré sur l'origine (0,0).
5.  **Comparaison (Template Matching) :** Le motif normalisé est comparé à un set de templates prédéfinis via la méthode de la distance angulaire (Distance at Best Angle). 

Nous avons dû générer manuellement des dizaines de templates mathématiques (cercles tracés en sens horaire/anti-horaire, triangles en partant du haut, du bas, etc.) pour garantir une détection robuste peu importe la façon de dessiner de l'utilisateur.

### 3.3 IA Ennemie et *Pathfinding*
Les ennemis n'utilisent pas un *NavMesh* complet (pour des raisons d'optimisation temporelle), mais un système de *Steering Behaviors* (comportements de pilotage) basés sur la distance et les vecteurs de direction par rapport au joueur. 
Un `WaveManager` orchestre l'apparition (spawning) des ennemis. Il gère la difficulté procéduralement, augmentant les statistiques (HP, dégâts, vitesse) au fil du temps. Les ennemis sont catégorisés par affinité élémentaire (Feu, Eau, Terre, etc.), les rendant plus ou moins vulnérables à certains types de sorts du joueur.

## 4. Défis Techniques et Solutions Apportées

### 4.1 La complexité des VFX (Système de particules)
Babylon.js dispose d'un système de particules complexe. Créer des effets visuels satisfaisants pour 16 sorts différents (tornades, explosions, zones de ralentissement, projectiles guidés) a été particulièrement chronophage.
*Solution :* Nous avons opté pour la création d'une architecture modulaire dans `SpellBehaviors.js`. Chaque sort (projectile, AoE, buff, spray) dérive de modèles abstraits. Plutôt que de coder des shaders complexes, nous avons exploité les `ParticleSystem` avec des courbes de vélocité, des variations d'opacité (ColorOverLife) et des spritesheet texturés. Le réglage fin des tornades (attraction des ennemis vers le centre) a nécessité le couplage de la physique (PhysicsImpostor) avec les effets visuels.

### 4.2 L'imprécision du système de reconnaissance
Malgré l'algorithme `$1 Unistroke`, la reconnaissance restait imparfaite. Si le joueur trace un triangle rapidement, la boucle de détection de MediaPipe peut sauter des *frames*, résultant en une forme non identifiée.
*Solution de contournement :* Plutôt que d'essayer d'avoir un algorithme 100% parfait (impossible vu la disparité des webcams des joueurs), nous avons :
1. Ajouté une animation de "validation" du tracé (fondu jaune) pour donner un *feedback* immédiat.
2. Limité le catalogue de sorts actifs à 3 ou 4 symboles très distincts (V, Cercle, Ligne) pour limiter les faux positifs.

### 4.3 Goulet d'étranglement des performances (CPU vs GPU)
Faire tourner un modèle de Machine Learning (MediaPipe) ET un moteur 3D (Babylon.js) simultanément sur le *main thread* du navigateur a entraîné de lourdes chutes de FPS.
*Optimisations appliquées :* 
- Gel du rendu des meshes hors-champ (Frustum Culling natif de Babylon).
- Désactivation du calcul d'ombres dynamiques complexes, remplacées par un *baked lighting* approximatif sur les personnages.
- Nettoyage rigoureux (garbage collection) et instanciation (plutôt que clonage lourd) des dizaines d'ennemis avec la méthode `instantiateModelsToScene` pour réduire les draw calls.
- Limitations des appels MediaPipe (on *skip* le traitement si le navigateur signale une surcharge).

### 4.4 L'équilibrage (Game Design)
Trouver le "flow" (ni trop simple, ni trop dur). Le temps nécessaire pour tracer un sort physiquement est beaucoup plus long qu'un simple clic.
*Ajustement :* Nous avons instauré des sorts à longue durée de vie (comme des zones de feu persistantes ou des tornades aspirantes) afin que le joueur puisse "souffler" et préparer son prochain tracé. Le `WaveManager` a été réglé pour offrir des vagues avec des temps de pause.

### 4.5 Cohérence des assets et Collisions
Trouver des *assets* 3D `.glb` gratuits, de style cohérent, et surtout riggés pour l'animation (mixamo) a été une gageure. Nous avons dû retraiter manuellement l'échelle, les origines (pivot) et la rotation locale (Quaternions) de certains modèles.
Ensuite, les collisions basées sur des meshes complexes coûtaient trop cher en performances.
*Solution :* Nous avons encapsulé les modèles 3D complexes dans des Hitboxes invisibles primitives (Box/Cylindre). La logique physique ne s'applique qu'à ces primitives.

## 5. Ce dont nous sommes les plus fiers
*   **L'intégration MediaPipe / Jeu vidéo :** Réussir à avoir un *gameplay loop* fonctionnel uniquement contrôlé par un flux webcam, sans aucune librairie intermédiaire toute faite, est une belle réussite d'ingénierie web.
*   **Le Système d'Astrolabe (Hub) :** L'interface de préparation (Loadout) avec la roue des éléments et l'assignation libre des runes (glisser-déposer des symboles) offre une véritable dimension RPG.
*   **La robustesse du code de combat :** Le système de `SpellDatabase` couplé au `SpellBehaviors` permet d'ajouter un nouveau sort au jeu en moins de 10 lignes de configuration JSON. C'est une architecture saine et évolutive.

## Conclusion
Le résultat est certes perfectible (notamment sur l'optimisation extrême et la fidélité des *hitboxes*), mais l'expérience de jeu — "jeter des sorts avec ses propres mains" — fonctionne et répond parfaitement à la proposition de valeur initiale.
