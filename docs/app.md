# KronoTab — Guide général de l'application

> Navigation : **Application (Global)** · [Timers](./timers.md) · [Todos](./todos.md) · [Notes](./notes.md)

**KronoTab** est un espace de productivité tout-en-un intégré à Google Chrome, combinant **Focus Timers**, **Multi-Todos**, **Notepad enrichi** et **Tableaux Kanban**, avec synchronisation temps réel entre toutes vos fenêtres.

---

## 1. Modes d'ouverture

### Panneau latéral Chrome (Side Panel)
- Cliquez sur l'icône **KronoTab** dans la barre d'outils de Chrome pour ouvrir l'application dans le panneau latéral.
- Le panneau reste ouvert à côté de vos pages web lorsque vous changez d'onglet.

### Fenêtre indépendante (détachée)
- Depuis le panneau latéral Chrome uniquement, ouvrez le menu **`⋮`** (en haut à droite) et cliquez sur **« Lancer dans une fenêtre indépendante »** (ou via **À propos → Ouvrir en fenêtre dédiée**).
- Lorsque l'application est déjà ouverte en fenêtre indépendante (ou dans un onglet), cette action est automatiquement masquée afin de garder le menu épuré.

### Raccourci Bureau Windows (Mode Application)
Pour lancer KronoTab directement depuis votre Bureau ou votre barre des tâches Windows :
1. Ouvrez le menu **`⋮` → À propos & Tutoriel Raccourci**.
2. Copiez la commande pré-remplie avec l'identifiant de votre extension :
   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="chrome-extension://<ID_EXTENSION>/sidepanel.html?standalone=1" --window-size=435,820
   ```
3. Créez un nouveau raccourci sur votre Bureau Windows et collez cette commande.

---

## 2. Conservation des dimensions des fenêtres

Chaque fenêtre flottante de KronoTab mémorise automatiquement ses dimensions dès que vous la redimensionnez :
- **Fenêtre principale indépendante** (`435 × 820 px` par défaut)
- **Fenêtre Kanban** (`1150 × 760 px` par défaut)
- **Fenêtre flottante du Minuteur circulaire** (`330 × 420 px` par défaut)

À chaque réouverture, la fenêtre retrouve exactement la largeur et la hauteur que vous aviez choisies.

---

## 3. Navigation et raccourcis globaux

| Raccourci | Action |
| :--- | :--- |
| **`Ctrl + Tab`** | Passer à l'onglet suivant (`Timers` → `Todos` → `Notes`) |
| **`Ctrl + Shift + Tab`** | Revenir à l'onglet précédent (`Notes` → `Todos` → `Timers`) |
| **`Échap` (`Esc`)** | Fermer la modale active, un menu ouvert ou une édition en cours |

### Barre d'onglets épinglable / rétractable (AppBar)
- **Mode épinglé (par défaut)** : la barre d'onglets (**Timers**, **Todos**, **Notes**) reste affichée en permanence sous l'en-tête. Cliquez sur le bouton **Épingle** à droite de la barre (ou via **`⋮` → Masquer la barre d'onglets**) pour la rétracter et gagner de l'espace vertical.
- **Mode désépinglé (masqué)** : la barre d'onglets disparaît ; le nom de la section active accompagné d'un chevron (`▾`) s'affiche directement dans l'*AppBar*.
- **Menu de navigation rapide** : cliquez sur le nom de la section active dans l'*AppBar* pour ouvrir le menu déroulant proposant les 3 onglets (**Todos**, **Timers**, **Notes**) ainsi que l'action **« Épingler la barre d'onglets »** pour la réafficher en permanence.

### Comportement des menus et modales
- **Fermeture au clic extérieur** : tous les menus (menu Options `⋮`, sélecteur de thème, menus de couleurs des Notes, menu contextuel des tâches) se ferment automatiquement dès que vous cliquez en dehors.
- **Animations fluides** : toutes les modales et le tiroir latéral Kanban s'ouvrent et se ferment avec une transition douce (et respectent automatiquement la préférence système *Réduire les animations*).

---

## 4. Thème et couleurs (Material Design 3)

Cliquez sur l'icône **Palette** dans la barre supérieure (disponible dans l'application principale et dans le Kanban) pour personnaliser l'apparence :
- **Mode d'affichage** : `Auto (Chrome)` (suit le thème système), `Clair` ou `Sombre`.
- **Couleurs d'accentuation** : *Ambre* (par défaut), *Bleu Chrome*, *Indigo*, *Sauge / Émeraude*, *Lavande* et *Terracotta / Rose*.

Le thème est synchronisé instantanément sur l'ensemble des fenêtres ouvertes (Side Panel, fenêtre indépendante, Kanban et Minuteur flottant).

---

## 5. Tableaux Kanban (Fenêtre dédiée)

Cliquez sur le bouton **`Kanban ↗`** dans l'en-tête pour ouvrir la fenêtre Multi-Kanban (ou la ramener au premier plan si elle est déjà ouverte).

### Tableau par défaut « Mes Todos » (Synchronisé)
- Le tableau **« Mes Todos »** est présent par défaut en tête de liste et **ne peut pas être supprimé**.
- Ses 3 colonnes (**Non commencé**, **En cours**, **Terminé**) reflètent en temps réel les tâches de votre onglet *Todos*.
- Vous pouvez filtrer par liste de tâches (`Toutes les listes` ou une liste spécifique) directement depuis l'en-tête du Kanban.

### Tableaux personnalisés et modèles de colonnes
- Cliquez sur le nom du tableau actuel (à gauche dans l'en-tête) pour ouvrir la **barre latérale des tableaux** : changer de tableau, voir le nombre de cartes/colonnes ou supprimer un tableau personnalisé.
- Cliquez sur **`+ Nouveau Tableau`** pour créer un tableau à partir d'un modèle (*Classique*, *Agile / Sprint Dev*, *Création & Publication*, *GTD Personnel* ou vos propres modèles).
- Cliquez sur l'icône **Paramètres (⚙)** pour créer, modifier, supprimer ou définir un modèle de colonnes par défaut.

### Interactions sur un tableau Kanban
- **Cartes** : glissez-déposez les cartes entre colonnes ou pour les réordonner, cliquez sur l'icône chronomètre pour lancer un Focus Timer éphémère, ou survolez une carte pour la modifier / supprimer.
- **Colonnes** *(tableaux personnalisés)* : glissez l'en-tête d'une colonne pour la déplacer, double-cliquez sur son titre pour la renommer, ou ajoutez de nouvelles colonnes.
- **Navigation panoramique (*Drag-to-Scroll*)** : cliquez-glissez sur l'arrière-plan du tableau pour faire défiler horizontalement les colonnes avec fluidité.

---

> Continuer la lecture : [Timers →](./timers.md) · [Todos →](./todos.md) · [Notes →](./notes.md)
