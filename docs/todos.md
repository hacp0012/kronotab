# KronoTab — Guide d'utilisation des Todos

> Navigation : [Application (Global)](./app.md) · [Timers](./timers.md) · **Todos** · [Notes](./notes.md)

L'onglet **Todos** propose une gestion multi-listes minimaliste et épurée inspirée de Google Tasks, enrichie de sous-tâches réellement imbriquées et d'une synchronisation bidirectionnelle automatique avec le Kanban.

---

## 1. Gérer vos listes et filtres

### Sélecteur de listes
- Utilisez le menu déroulant en haut à gauche pour basculer entre vos listes (*Général*, *Travail*, *Perso*, etc.) avec le compteur de tâches actives.
- Cliquez sur **`Listes (N)`** en bas à droite pour créer une nouvelle liste ou supprimer une liste existante.

### Filtres de tâches
Trois filtres distincts permettent d'organiser votre vue sans doublon :
- **`Actives`** : affiche toutes les tâches non terminées (*Non commencé* et *En cours*).
- **`En cours`** : filtre uniquement les tâches actuellement en cours de réalisation.
- **`Terminées`** : regroupe les tâches cochées, avec un bouton **`Vider terminées`** pour les purger en un clic.

---

## 2. Créer une tâche

Deux façons complémentaires de créer une tâche selon votre besoin :

### A. Ajout rapide à la volée (`[+]`)
- Survolez une tâche : un petit bouton **`[+]`** apparaît discrètement sur son bord inférieur.
- Cliquez sur **`[+]`** pour ouvrir un formulaire léger directement sous la tâche avec uniquement :
  - un champ **Titre** *(facultatif si la description est renseignée)* ;
  - une zone **Description** qui s'étend automatiquement au fur et à mesure que le texte grandit.
- Validez avec **`Entrée`** (depuis le titre), **`Ctrl + Entrée`** (depuis la description) ou le bouton **`Ajouter`**, ou annulez avec **`Échap`**.

### B. Modale complète (`+ Nouvelle tâche`)
Cliquez sur **`+ Nouvelle tâche`** en bas de l'écran pour accéder à toutes les options :
- **Titre** : facultatif si une description est déjà renseignée.
- **Description** : zone de texte extensible automatiquement jusqu'à une hauteur maximale confortable (avec défilement interne au-delà).
- **Durée prévue** *(liste déroulante)* : **`Sans heure`** par défaut, durées prédéfinies (`5 min` à `2 heures`), ou **`Durée personnalisée...`** pour saisir un nombre exact de minutes.
- **Statut** et **Priorité** : deux listes déroulantes placées côte à côte (*Non commencé / En cours / Terminé* et *Basse / Moyenne / Haute*).

---

## 3. Lire et modifier une tâche directement dans la liste

- **Cocher / décocher** : cliquez sur le cercle à gauche de la tâche pour la marquer comme terminée (ou la réactiver).
- **Infobulle sur les titres longs** : les titres longs sont tronqués proprement sur une ligne (`...`) ; survolez-les (ou placez-y le focus clavier) pour afficher le titre complet dans une infobulle.
- **Double-clic sur le titre** : ouvre la modale complète d'édition de la tâche.
- **Plier / déplier la description** : cliquez simplement une fois sur la description pour l'étendre en entier ou la replier sur une ligne compacte.
- **Édition à la volée de la description** : **double-cliquez** sur la description pour la modifier directement sur place dans un champ sans bordure et auto-extensible. Cliquez en dehors (ou appuyez sur `Ctrl + Entrée`) pour enregistrer, ou `Échap` pour annuler.
- **Lancer le minuteur** : si une durée est définie (ex. `25 min`), cliquez directement dessus pour démarrer un minuteur éphémère (la tâche passe automatiquement en état *En cours*).

---

## 4. Sous-tâches imbriquées

Les sous-tâches sont réellement rattachées à leur tâche parente :
- **Ajouter une sous-tâche** : ouvrez le menu contextuel d'une tâche parente → **« Ajouter une sous-tâche »**.
- **Plier / déplier les sous-tâches** : cliquez sur le chevron **`▸` / `▾`** (ou sur le compteur `x/y`) directement sur la tâche parente pour réduire ou étendre ses sous-tâches.
- **Imbriquer / Promouvoir** :
  - Via le menu contextuel : **« Mettre en sous-tâche »** (rattache à la tâche parente précédente) ou **« Promouvoir en tâche principale »**.
  - Via le **glisser-déposer** : déplacez une tâche parente pour emporter automatiquement toutes ses sous-tâches avec elle ; glissez une tâche vers la droite sur une autre pour la transformer en sous-tâche, ou glissez une sous-tâche vers la gauche pour la promouvoir.
- **Suppression** : supprimer une tâche parente supprime également ses sous-tâches rattachées.

---

## 5. Menu contextuel des tâches

Cliquez sur le bouton **`⋮`** à droite d'une tâche — ou faites un **clic droit** directement sur la ligne — pour ouvrir son menu contextuel :
- **Statut rapide** : `À faire`, `En cours`, `Terminé`.
- **Priorité rapide** : `Basse`, `Moyenne`, `Haute`.
- **Modifier** : ouvre la modale complète.
- **Ajouter une sous-tâche** *(tâches parentes)* et **Plier / Déplier les sous-tâches**.
- **Lancer un minuteur** : lance un Focus Timer éphémère (durée de la tâche ou `25 min` par défaut).
- **Mettre en sous-tâche** / **Promouvoir en tâche principale**.
- **Copier vers un autre Kanban** : envoie une copie dans l'un de vos tableaux Kanban personnalisés.
- **Supprimer** : supprime la tâche.

---

## 6. Synchronisation automatique avec le Kanban

Vos tâches Todos sont **automatiquement synchronisées en temps réel** avec le tableau Kanban par défaut **« Mes Todos »** :
- Les 3 états (`Non commencé`, `En cours`, `Terminé`) correspondent exactement aux 3 colonnes du tableau.
- Déplacer une carte dans le Kanban met immédiatement à jour le statut de la tâche dans les Todos (et inversement).
- Créer, éditer ou supprimer une carte dans **« Mes Todos »**, ou cocher ses sous-tâches dépliables, modifie directement vos listes de Todos.

---

> Continuer la lecture : [Application (Global) →](./app.md) · [Timers →](./timers.md) · [Notes →](./notes.md)
