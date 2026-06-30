# Conformité — Protection des données (loi 09-08 / RGPD)

**Produit :** Synapse Digital — Plateforme IA RH · **Éditeur :** Waminey Tech
**Référence cahier des charges :** §3.3 Sécurisation · §4.1 Éthique · §4.4 Sécurité & confidentialité
**Statut :** version de démonstration (données synthétiques déterministes — aucun collaborateur réel).

Ce document constitue le **registre des traitements** et la **note de conformité** de la plateforme.
Il documente les finalités, les bases légales, la durée de conservation, les droits des personnes et
les mesures de sécurité — comme exigé par le cahier (« Documentation des finalités de traitement, des
droits d'accès et des mécanismes de suppression ou d'anonymisation »).

---

## 1. Registre des finalités de traitement

| Finalité | Données traitées | Base légale | Accès | Conservation | Révocable |
|---|---|---|---|---|---|
| Assistant RH conversationnel | Question, contexte du rôle, historique | Intérêt légitime (service RH) | Le collaborateur (ses échanges) | 12 mois (logs IA) | — |
| Analyse de sentiment du climat | Commentaires d'humeur | **Consentement** | RH/Direction (agrégé, anonymisé, min_n=3) | 24 mois | ✅ |
| Détection des signaux de désengagement | Absences, humeur, charge, ancienneté | **Consentement** | RH / manager (équipe) | 24 mois | ✅ |
| Journalisation des interactions IA | Horodatage, catégorie, indicateurs de sécurité (contenu **chiffré**) | Intérêt légitime (sécurité) | Administrateur | 12 mois | — |
| Génération documentaire | Données autorisées du collaborateur | Exécution du contrat de travail | Le collaborateur / RH | Selon document | — |

Source applicative : `FINALITES` dans [confidentialite.py](../backend/app/api/v1/endpoints/confidentialite.py) (servi via `GET /confidentialite/me`),
`LOG_RETENTION_DAYS` dans [config.py](../backend/app/core/config.py) (purge automatique des journaux IA).

## 2. Consentement (traitements analytiques avancés)

- Modèle **par finalité, révocable** : table `Consentement` ([models.py](../backend/app/db/models.py)).
- Le collaborateur gère son consentement via `GET`/`PATCH /confidentialite/me`.
- **Application effective** : le scoring ML de désengagement **exclut** les collaborateurs ayant retiré
  leur consentement (`matricules_refusant("detection_desengagement")` filtré dans
  [ml_predictions.py](../backend/app/services/ml_predictions.py) `batch_score`). L'analyse de sentiment
  est par ailleurs toujours agrégée/anonymisée (seuil `min_n`).

## 3. Droits des personnes

| Droit | Mécanisme | Endpoint |
|---|---|---|
| Accès / portabilité | Export structuré de ses données | `GET /confidentialite/me/export` |
| Information / transparence | Registre des finalités + état des consentements | `GET /confidentialite/me` |
| Rectification | Édition du profil (téléphone, bio, photo) | `PATCH /employees/me` |
| Opposition / retrait | Révocation du consentement par finalité | `PATCH /confidentialite/me` |
| **Effacement (anonymisation)** | Demande par le collaborateur, **exécution RH/Admin** | `POST /confidentialite/me/effacement` → `POST /confidentialite/{matricule}/anonymiser` |

**Effacement par anonymisation** ([repository.py](../backend/app/db/repository.py) `anonymize_employee`) :
identifiants directs retirés (nom, prénom, e-mail, téléphone, date de naissance, photo), dossier
confidentiel (CIN/adresse) supprimé, contenu des documents / interactions / messages effacé ; la
**ligne pseudonymisée est conservée** pour l'intégrité des agrégats statistiques. L'exécution reste
sous **responsabilité humaine** (RH/Admin) — cf. §4.1 « les décisions sensibles restent sous
responsabilité humaine » — et est **journalisée** (audit `ANONYMISATION`).

## 4. Mesures de sécurité (cahier §3.3 / §4.4)

**Authentification & contrôle d'accès**
- Keycloak / OIDC, JWT **RS256 dont la signature est toujours vérifiée** via le JWKS
  ([security.py](../backend/app/core/security.py)). Le repli « dev-login » (jetons non signés) est
  **interdit en production** (`ALLOW_DEV_LOGIN`, bloque le démarrage si actif en prod).
- Protection brute-force Keycloak activée (verrouillage après 5 échecs — [ydays-realm.json](../backend/data/ydays-realm.json)).
- **Moindre privilège** : RBAC (`require_roles`) + ABAC ([scope.py](../backend/app/core/scope.py)) — un manager
  est strictement limité à son équipe ; vérification du rôle **avant** toute réponse IA sensible
  (`_TYPE_ROLES`, moteur E5 ABAC dans [pipeline.py](../backend/app/services/pipeline.py)).

**Protection des données sensibles**
- **Chiffrement au repos** (Fernet/AES — [crypto.py](../backend/app/services/crypto.py)) : interactions IA
  (prompts/réponses), **historiques de conversation** (messages de chat), dossier confidentiel (CIN/adresse).
- **Masquage PII obligatoire** avant tout appel au LLM externe ([pii.py](../backend/app/services/pii.py),
  `PII_MASKING` — démarrage **bloqué** si désactivé). Le moteur déterministe E5 n'envoie **jamais** de
  donnée personnelle au LLM.
- **Séparation des données sensibles** : dossier confidentiel isolé ; données médicales réservées à la
  médecine du travail ; **anonymisation analytique** (agrégats avec seuil `min_n=3`, [kpi_service.py](../backend/app/services/kpi_service.py)).
- **Journalisation / traçabilité** : audit automatique des écritures (`journal_audit`,
  [audit.py](../backend/app/db/audit.py)) + journal des accès sensibles (`SENSITIVE_DATA_VIEW`).

**Sécurité applicative**
- Validation des entrées (Pydantic v2) ; requêtes paramétrées (SQLAlchemy ORM → anti-injection SQL).
- **En-têtes de sécurité HTTP** : `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, et `Strict-Transport-Security` en production ([main.py](../backend/app/main.py)).
- **Anti-prompt-injection** ([security_filter.py](../backend/app/services/security_filter.py)) + filtrage des
  réponses (masquage PII) + règles empêchant l'IA de divulguer des informations hors périmètre.
- **CORS** restreint aux origines de confiance (pas de wildcard).

**Supervision & alertes**
- Journaux d'interactions IA exploitables par l'admin **sans exposer le contenu** (révélation tracée).
- Indicateurs de sécurité (`/ai/security-stats`) : tentatives d'accès refusées 24 h / 7 j, par gravité.
- **Alertes** sur tentative d'accès hors périmètre, classées : anomalie simple (`acces_refuse`),
  tentative répétée (`acces_refuse_repete`), critique (`securite`), risque de fuite (`fuite_donnees`) ;
  historique conservé pour audit.

## 5. Éthique de l'IA (cahier §4.1)

- **Prévention des biais** : audit d'équité (`fairness_audit`, règle des 4/5 — disparate impact) et
  **exclusion des attributs protégés** (âge, genre, site, type de contrat) des variables du modèle.
- **Explicabilité** : chaque score est accompagné de ses principaux facteurs contributifs.
- **Responsabilité humaine** : l'IA est une aide à la décision (redirection vers un référent RH,
  refus contrôlés) ; les décisions sensibles et l'effacement restent humaines.
- **Supervision encadrée** : limitée à la sécurité/conformité, contenu des conversations masqué.

## 6. Sous-traitance / transferts

L'inférence LLM est déléguée à un fournisseur externe (OpenRouter). **Aucune donnée personnelle en
clair** ne lui est transmise : masquage PII systématique + moteur déterministe E5 pour les données
sensibles. Une alternative auto-hébergée (modèle open-source) est documentée comme évolution (§4.6).

## 7. Minimisation & conservation

Collecte limitée aux finalités ci-dessus ; journaux IA purgés au-delà de `LOG_RETENTION_DAYS` (90 j par
défaut) ; agrégats analytiques anonymisés ; CIN partiellement masqué dans l'assistant (détail réservé
au module Dossier, accès tracé).
