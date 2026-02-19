# CV — Mathéo BALENS · Decision Network

Projet de CV maintenu avec **React + Vite + Tailwind CSS**.

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:5173` dans le navigateur.

## Mettre à jour le CV

Toutes les données sont dans **`src/data/resume.json`** :

| Clé              | Description                                    |
|------------------|------------------------------------------------|
| `personal`       | Nom, titre, sous-titre, site web               |
| `summary`        | Liste "En bref"                                |
| `experiences`    | Missions / Expériences (par expérience)        |
| `profileSkills`  | Compétences profil avec niveau (1 à 4)         |
| `skills`         | Compétences détaillées (colonne droite)        |
| `education`      | Formations                                     |

## Exporter en PDF A4

1. Ouvrir `http://localhost:5173`
2. Cliquer sur **"Télécharger en PDF"**
3. Dans la fenêtre d'impression : choisir **"Enregistrer en PDF"**
4. Format : **A4**, marges : **Aucune**

## Build production

```bash
npm run build
```

Le dossier `dist/` contient le site statique déployable sur Netlify / GitHub Pages.
