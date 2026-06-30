# Design System — Synapse Digital (SD_26)

Galerie visuelle des composants de l'application, synchronisable avec **Claude Design**
(`claude.ai/design`) via le skill `/design-sync`.

## Comment l'utiliser
1. Les aperçus sont des fichiers HTML autonomes dans `foundations/` et `components/`.
   Chaque fichier commence par un commentaire `<!-- @dsCard group="…" -->` qui le transforme
   en vignette dans le panneau Claude Design.
2. Lance **`/design-sync`** dans le chat → autorise la connexion claude.ai → la galerie apparaît.
3. Regarde les vignettes, demande des améliorations → on modifie ici puis on **réapplique** dans
   le code React (`frontend/src`).

## Source de vérité des tokens
Les couleurs/typo viennent de `frontend/src/styles/index.css` (thème clair + `[data-theme="dark"]`).
`tokens.css` en est la copie documentée. Si le thème change dans l'app, mettre à jour `tokens.css`.

## Contenu
- `foundations/colors.html` — palette (clair) + sémantique (success/warning/danger/info)
- `foundations/typography.html` — échelle typographique et polices
- `components/buttons.html` — boutons (or / contour / fantôme, tailles, désactivé)
- `components/badges.html` — badges & statuts
- `components/cards.html` — cartes & en-têtes de section
- `components/fields.html` — champs de formulaire (input/select/textarea/checkbox/range)
- `components/data-display.html` — avatar, étoiles, barre de progression, état vide
