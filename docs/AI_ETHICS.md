# Charte éthique de l'IA — Synapse Digital

**Éditeur :** Waminey Tech · **Réf. cahier :** §4.1 Éthique et pertinence de l'IA
L'IA de Synapse Digital est un **outil d'aide à la décision** au service des personnes, jamais un mécanisme de surveillance ou de sanction.

## 1. Principes

1. **L'humain décide.** Aucune décision RH n'est automatisée. Les scores et alertes **proposent** ; un responsable humain tranche. L'assistant **redirige vers un référent RH** pour toute situation sensible ou ambiguë.
2. **Non-discrimination.** Les modèles **excluent les attributs protégés** (âge, genre, site, type de contrat). Un **audit d'équité** (disparate impact, règle des 4/5) surveille les écarts entre groupes. Cf. [MODEL_CARD.md](MODEL_CARD.md).
3. **Explicabilité.** Chaque score s'accompagne de ses **facteurs contributifs** lisibles, pour éviter toute décision opaque.
4. **Minimisation & finalité.** Seules les données utiles à une finalité documentée sont traitées ; les analyses se font sur des **agrégats anonymisés** (seuil k-anonymat). Cf. [CONFORMITE_RGPD_0908.md](CONFORMITE_RGPD_0908.md).
5. **Consentement.** Les traitements analytiques avancés (détection du désengagement, analyse de sentiment) sont soumis à **consentement révocable** ; un retrait **exclut** la personne du profilage.
6. **Confidentialité dès la conception.** Les données personnelles ne quittent jamais le système en clair : **masquage PII** avant tout LLM externe, moteur déterministe pour les données sensibles, **chiffrement au repos** des conversations.
7. **Supervision encadrée.** L'analyse des usages de l'IA vise **uniquement** la sécurité, la conformité et l'amélioration du service ; le contenu des conversations est **masqué** aux superviseurs (révélation exceptionnelle, tracée). Pas de surveillance individuelle des collaborateurs.
8. **Transparence.** Les finalités, les durées de conservation et les personnes autorisées à consulter les alertes sont documentées et consultables par le collaborateur (`GET /confidentialite/me`).

## 2. Limites assumées
- Modèles entraînés sur **données synthétiques** → performances indicatives, non transférables au réel sans ré-entraînement encadré.
- Le risque de **turnover** est faible statistiquement (AUC ≈ 0.54) et présenté comme tel — il ne fonde aucune décision.
- Corrélation ≠ causalité : un score n'est pas un jugement sur la valeur d'une personne.

## 3. Gouvernance
- Décisions sensibles sous **responsabilité humaine** (le droit à l'effacement s'exécute par un RH/Admin, pas automatiquement).
- **Auditabilité** : journalisation des accès, alertes et décisions de blocage, consultable par les profils autorisés.
- **Droit de recours** : le collaborateur peut consulter ses données (`/export`), retirer un consentement, et demander l'anonymisation.

## 4. Engagement
Toute évolution des modèles ou des finalités fait l'objet d'une mise à jour de cette charte, de la Model Card et du registre de conformité, avant mise en service.
