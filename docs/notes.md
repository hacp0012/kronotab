# KronoTab — Guide d'utilisation des Notes

> Navigation : [Application (Global)](./app.md) · [Timers](./timers.md) · [Todos](./todos.md) · **Notes**

L'onglet **Notes** offre un bloc-notes plein écran sans bordure avec sauvegarde automatique instantanée, formatage riche, raccourcis Markdown intelligents et balises de minuteur intégrées.

---

## 1. Gérer vos notes

- **Création** : cliquez sur **`+ Note`** en bas à gauche pour démarrer une nouvelle note vierge.
- **Parcourir et rechercher** : cliquez sur **`Notes (N)`** pour ouvrir la modale listant toutes vos notes, avec recherche en temps réel sur les titres et le contenu.
- **Épingler** : cliquez sur l'icône **Épingle** pour maintenir une note importante en haut de la liste.
- **Persistance** : votre dernière note consultée reste automatiquement ouverte lorsque vous changez d'onglet ou rouvrez KronoTab.
- **Ponts rapides** : transformez la note courante en tâche (**`+ Todo`**) ou en carte Kanban (**`→ Kanban`**) en un clic depuis la barre inférieure.

---

## 2. Barre de formatage riche (Responsive)

Située au-dessus de la barre d'actions inférieure, elle est divisée en deux zones (outils de mise en forme à gauche, police/couleurs/effacement à droite) :
- **Menu de débordement automatique** : lorsque vous réduisez la largeur de la fenêtre et que la partie droite approche de la partie gauche, les outils qui ne tiennent plus se regroupent automatiquement dans un menu déroulant **`⋯`**.
- **Styles** : Gras (`Ctrl + B`), Italique (`Ctrl + I`), Souligné (`Ctrl + U`), Barré.
- **Titres** : `H1` et `H2` (leur taille s'adapte proportionnellement au zoom de la police).
- **Structures & insertions** : Liste à puces, Liste numérotée, **Case à cocher classique**, **Case à cocher 3 états (Todo)**, **Timer *inline*** (`[timer:00`), Citation, Ligne séparatrice.
- **Couleurs et nettoyage** : **Couleur du texte**, **Surligneur (marqueur)** et **Annuler la mise en forme** (Clear formatting).
- **Indicateur de taille de police** (`13px` par défaut) : cliquez dessus pour réinitialiser rapidement la taille par défaut.
- **Paramètres d'édition (`⚙`, à l'extrême droite — mémorisés par note)** : ouvre un menu regroupant :
  - **Retour à la ligne (*Word Wrap*)** : interrupteur pour activer ou désactiver le retour à la ligne automatique (avec défilement horizontal lorsqu'il est désactivé).
  - **Vérification orthographique (*Orthographe*)** : correcteur intégré **100 % hors-ligne** (indépendant des réglages Chrome) avec interrupteur d'activation et sélecteur de langue (**Français** ou **Anglais**). Les fautes sont soulignées en rouge ondulé ; un **clic** ou un **clic droit** sur un mot souligné ouvre un menu de suggestions de correction ainsi qu'une option pour **ignorer** le mot (réinitialisable depuis le sous-menu *Orthographe*).
  - **Persistance individuelle** : la taille de police, le retour à la ligne, l'état et la langue du correcteur orthographique ainsi que les mots ignorés sont conservés **indépendamment pour chaque note**.

---

## 3. Raccourcis d'écriture intelligents (Markdown & Indentation)

La zone de saisie reconnaît automatiquement vos habitudes de rédaction :

### Retrait et indentation automatique
- **`Tab`** : insère une tabulation en retrait (ou indente un élément de liste / une case à cocher).
- **`Shift + Tab`** : réduit le retrait d'un niveau (texte, liste ou case à cocher).
- **Indentation automatique** : lorsque vous appuyez sur **`Entrée`** sur une ligne indentée, la ligne suivante conserve automatiquement le même niveau d'indentation. Appuyer sur `Entrée` sur une ligne indentée vide annule proprement le retrait.

### Listes automatiques
En début de ligne, tapez l'un des marqueurs suivants puis **`Espace`** :
- **`-`**, **`+`** ou **`*`** + `Espace` → crée automatiquement une **liste à puces**.
- **`1.`** *(ou tout nombre suivi d'un point)* + `Espace` → crée automatiquement une **liste numérotée**.

### Cases à cocher Markdown automatiques (2 états et 3 états)
En début de ligne, tapez l'un des motifs suivants puis **`Espace`** :
- **`[]`**, **`[ ]`**, **`- [ ]`** ou **`+ [ ]`** + `Espace` → crée une **case à cocher classique** non cochée.
- **`[x]`**, **`[X]`**, **`- [x]`** ou **`+ [x]`** + `Espace` → crée une **case à cocher classique** déjà cochée.
- **`[/]`**, **`[-]`**, **`- [/]`** ou **`- [-]`** + `Espace` → crée une **case à cocher à 3 états** en statut *En cours*.

Vous pouvez aussi insérer une **case classique** ou une **case à 3 états** directement depuis la barre de formatage :
- **Case classique** : bascule entre *non cochée* (`[ ]`) et *cochée* (`[x]`).
- **Case 3 états (Todo)** : chaque clic fait évoluer l'avancement dans l'ordre : **Non commencée** (`[ ]`) → **En cours** (`[/]`) → **Terminée** (`[x]`).
- **`Entrée`** : crée une nouvelle case du même type et au même niveau d'indentation (ou quitte la liste si la ligne est vide).
- **`Tab` / `Shift + Tab`** : décale la case vers la droite ou la gauche (jusqu'à 5 niveaux).
- **`Retour arrière` (`Backspace`)** en début de ligne : réduit le retrait ou reconvertit la ligne en paragraphe normal.

---

## 4. Balises Timer inline (`[timer:...]`)

Vous pouvez intégrer directement un minuteur cliquable au milieu de n'importe quelle phrase en utilisant le bouton **Timer *inline*** de la barre de formatage (qui insère `[timer:00` afin que vous saisissiez votre durée suivie de `]`) ou en tapant directement l'un des 3 formats :

| Syntaxe saisie | Durée interprétée | Affichage *inline* |
| :--- | :--- | :--- |
| **`[timer:25]`** | 25 minutes (`mm`) | Pastille `⏱ 25:00` |
| **`[timer:05:30]`** | 5 minutes et 30 secondes (`mm:ss`) | Pastille `⏱ 05:30` |
| **`[timer:01:15:00]`** | 1 heure et 15 minutes (`hh:mm:ss`) | Pastille `⏱ 01:15:00` |

### Fonctionnement
- **Transformation instantanée** : dès la fermeture du crochet `]` (ou lors d'un copier-coller), la balise se transforme en une pastille *inline* intégrée directement dans le texte.
- **Lancement au clic** : cliquez sur la pastille (ou appuyez sur `Entrée`/`Espace` lorsqu'elle a le focus) pour ouvrir immédiatement la **petite fenêtre flottante circulaire** et démarrer le compte à rebours.
- **Minuteur éphémère** : ce timer n'est pas conservé dans la liste de vos minuteurs enregistrés ; comme les timers lancés depuis les *Todos*, il disparaît automatiquement une fois terminé et acquitté.
- **Suppression** : positionnez le curseur juste après la pastille et appuyez sur `Retour arrière` (`Backspace`) pour la supprimer d'un seul coup.

---

## 5. Zoom de la police et suivi automatique du curseur

| Raccourci *(dans la zone de saisie)* | Action |
| :--- | :--- |
| **`Ctrl +`** *(ou `Ctrl + =`)* | Augmenter la taille de la police (`+1 px`, jusqu'à `28 px`) |
| **`Ctrl -`** | Diminuer la taille de la police (`-1 px`, jusqu'à `10 px`) |
| **`Ctrl 0`** | Réinitialiser la taille de la police à `13 px` |

La taille choisie est mémorisée automatiquement pour chaque note.

### Suivi automatique du curseur
Si vous faites défiler une longue note vers le haut ou vers le bas et que votre curseur sort de la zone visible, l'affichage **défile automatiquement jusqu'au curseur** dès que vous reprenez la saisie ou déplacez le curseur au clavier, en tenant compte de la barre d'outils en bas de l'écran.

---

> Continuer la lecture : [Application (Global) →](./app.md) · [Timers →](./timers.md) · [Todos →](./todos.md)
