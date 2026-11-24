# KronoTab — Guide d'utilisation des Timers

> Navigation : [Application (Global)](./app.md) · **Timers** · [Todos](./todos.md) · [Notes](./notes.md)

L'onglet **Timers** permet de gérer plusieurs minuteurs Focus en parallèle avec des alertes fiables en arrière-plan, un badge en temps réel sur l'icône Chrome et une fenêtre flottante circulaire.

---

## 1. Créer un minuteur

1. Cliquez sur **`+ Nouveau Minuteur`** en bas de l'onglet **Timers**.
2. Renseignez :
   - **Titre du minuteur** *(optionnel — généré automatiquement selon la durée si laissé vide)*.
   - **Durées rapides** : préréglages en un clic (`10m`, `20m`, `30m`, `45m`, `60m`).
   - **Durée personnalisée (`hh : mm : ss`)** : précision à la seconde près.
   - **Alarme répétitive en boucle** : lorsque activée, la sonnerie se répète jusqu'à votre validation.
   - **Sonnerie de fin** : choisissez parmi les **12 sonneries intégrées** et cliquez sur **« Écouter »** pour en avoir un aperçu immédiat.
3. Validez avec **« Créer le minuteur »**.

Les minuteurs sont automatiquement triés par ordre croissant de durée.

---

## 2. Contrôles d'un minuteur

Sur chaque carte minuteur :
- **Démarrer / Pause / Reprendre / Relancer** : contrôle l'état du compte à rebours avec anneau de progression fluide (60 FPS).
- **`+1m`** : ajoute 1 minute à la session en cours (sans modifier la durée initiale enregistrée du minuteur).
- **Réinitialiser (`↺`)** : remet le minuteur à sa durée de départ.
- **Sélecteur de sonnerie** : change la sonnerie directement depuis la carte (avec aperçu sonore instantané).
- **`Boucle` / `1x`** : active ou désactive la répétition de l'alarme en fin de compte à rebours.
- **`Flottant`** : ouvre ce minuteur spécifique dans la petite fenêtre flottante circulaire.
- **`×`** : supprime le minuteur.

---

## 3. Sonneries disponibles (12 intégrées)

La sonnerie par défaut est **« Bip Digital »** pour tous les nouveaux minuteurs (manuels, issus des Todos, des Notes ou du Kanban).

| Sonnerie | Caractère |
| :--- | :--- |
| **Bip Digital** *(défaut)* | Signal court et précis |
| **Carillon Cristal** | Arpège cristallin doux |
| **Marimba Boisé** | Notes chaudes et naturelles |
| **Bol Tibétain Zen** | Résonance apaisante 432 Hz |
| **Pulsation Énergique** | Mélodie dynamique de fin de sprint |
| **Aurore Douce** | Accord éthéré ascendant |
| **Radar Classique** | Bip rythmé façon alarme moderne |
| **Harpe Céleste** | Glissando lumineux apaisant |
| **Rétro Arcade** | Fanfare 8-bit dynamique |
| **Clochette Bureau** | Tintement clair et net |
| **Kalimba Solaire** | Notes douces et boisées |
| **Gong Profond** | Vibration grave de fin de session |

---

## 4. Fenêtre flottante circulaire

Cliquez sur **`Fenêtre Circulaire`** (dans le pied de page) ou sur **`Flottant`** (sur un minuteur) pour détacher un widget compact et circulaire :
- Animation du cadran continu à **60 FPS**.
- Sélecteur en haut à droite pour basculer entre vos minuteurs s'il y en a plusieurs.
- Accès direct à **Démarrer / Pause**, **`+1m`**, **Réinitialiser**, **Boucle** et **Test sonore**.
- La fenêtre conserve automatiquement ses dimensions si vous la redimensionnez.

---

## 5. Alertes en arrière-plan et Badge Chrome

Les minuteurs continuent de fonctionner même si le panneau latéral et la fenêtre flottante sont fermés :
- **Badge sur l'icône Chrome** : affiche le temps restant du minuteur le plus proche de son terme (ex. `24m`, `1h`), puis **`!`** en rouge lorsqu'une alarme sonne.
- **Sonnerie en arrière-plan** : jouée automatiquement via un document audio dédié.
- **Notification système Chrome** avec deux actions rapides :
  - **`OK, d'accord`** : arrête la sonnerie et acquitte le minuteur.
  - **`+1 Min`** : relance immédiatement 1 minute supplémentaire.

---

## 6. Minuteurs éphémères (Todos, Notes & Kanban)

Les minuteurs lancés directement depuis :
- une tâche **Todo** (clic sur la durée ou via le menu contextuel),
- une balise **`[timer:...]`** dans les **Notes**,
- une carte **Kanban**

sont créés en mode **éphémère** : ils utilisent la sonnerie **Bip Digital** par défaut, déclenchent normalement l'alarme et les notifications, puis sont **automatiquement supprimés dès leur acquittement** afin de ne pas encombrer votre liste de minuteurs enregistrés.

---

> Continuer la lecture : [Application (Global) →](./app.md) · [Todos →](./todos.md) · [Notes →](./notes.md)
