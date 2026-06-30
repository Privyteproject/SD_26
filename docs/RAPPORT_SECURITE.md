# Rapport de sécurité — Synapse Digital (Plateforme IA RH)

**Éditeur :** Waminey Tech · **Réf. cahier :** §3.3 Sécurisation, §4.4 Sécurité & confidentialité
**Périmètre :** application (FastAPI + React) + assistant IA + base RH interne. Hors périmètre : durcissement OS/serveur (runbook Linux séparé).

## 1. Synthèse
La sécurité est traitée **par conception** (defense in depth, moindre privilège, fail securely, complete mediation). Les contrôles applicatifs exigés par le cahier sont **implémentés et testés automatiquement** (suite `pytest` : RBAC/ABAC, anti-injection, masquage PII, non-fuite de données sensibles). Les risques résiduels relèvent surtout de l'**exploitation/production** (secrets par défaut en dev, observabilité, déploiement durci) et sont documentés en §4.

## 2. Modèle de menace (STRIDE)

| Menace | Actif | Mitigation implémentée | Réf. | Statut |
|---|---|---|---|---|
| **Spoofing** (faux JWT) | Routes API | JWT **RS256 vérifié via JWKS** (issuer contrôlé) ; dev-login non signé **interdit en prod** | [security.py](../backend/app/core/security.py), [config.py](../backend/app/core/config.py) | ✅ |
| **Tampering** (entrée malveillante) | Données RH | Validation Pydantic v2 ; ORM paramétré (anti-SQLi) ; audit des écritures | schemas/, [audit.py](../backend/app/db/audit.py) | ✅ |
| **Repudiation** (déni d'action) | Intégrité d'audit | `journal_audit` automatique (INSERT/UPDATE/DELETE, diff, IP, auteur, horodatage) | [audit.py](../backend/app/db/audit.py) | ✅ (append-only par convention) |
| **Info Disclosure** (fuite paie/PII) | PII employés | RBAC + **ABAC** (manager = son équipe) ; **masquage PII** avant LLM ; moteur **E5 déterministe** (PII jamais envoyée au LLM) ; anonymisation analytique (min_n=3) | [pipeline.py](../backend/app/services/pipeline.py), [pii.py](../backend/app/services/pii.py), [scope.py](../backend/app/core/scope.py) | ✅ |
| **DoS** (flood IA) | Disponibilité | Rate limiting par utilisateur sur `/ai/chat` (429) | [rate_limit.py](../backend/app/services/rate_limit.py) | 🟡 (chat ; à étendre) |
| **Elevation of Privilege** | Intégrité RBAC | `require_roles` côté serveur sur chaque route (28 gardes) ; rôle vérifié à chaque appel | [security.py](../backend/app/core/security.py) | ✅ |
| **Prompt Injection** | Confiance LLM | Filtre regex (couche 1, toujours active) + LLM-Guard (couche 2, optionnelle) + durcissement du system prompt + journalisation | [security_filter.py](../backend/app/services/security_filter.py) | ✅ |
| **Container Escape** | Infrastructure | Pas de montage du socket Docker dans les conteneurs applicatifs | docker-compose.yml | ✅ |

## 3. Contrôles par exigence du cahier (§3.3)
- **Authentification & accès** : Keycloak/OIDC, RS256 vérifié, 6 rôles, moindre privilège (RBAC+ABAC), vérification du rôle **avant** réponse IA sensible. Brute-force Keycloak activée (verrouillage à 5 échecs).
- **Protection des données** : chiffrement au repos (Fernet) des interactions IA, **historiques de conversation**, dossier confidentiel (CIN/adresse) ; séparation des données sensibles ; conservation maîtrisée (logs IA purgés à 90 j).
- **Sécurité applicative** : validation des entrées, anti-injection SQL/prompt, **filtrage des réponses** (masquage PII), **en-têtes de sécurité HTTP** (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy ; HSTS en prod).
- **Supervision & alertes** : journaux IA exploitables sans exposer le contenu ; indicateurs de sécurité (`/ai/security-stats`) ; alertes sur tentative hors périmètre, classées (anomalie / répétée / critique / fuite) avec historique.
- **Conformité** : registre des finalités, consentement révocable **appliqué** au profilage ML, **anonymisation** (droit à l'effacement), masquage PII (cf. [CONFORMITE_RGPD_0908.md](CONFORMITE_RGPD_0908.md)).

## 4. Risques résiduels & recommandations

| # | Risque résiduel | Sévérité | Recommandation |
|---|---|---|---|
| R1 | Secrets par défaut en dev (`*_secret_pass`, `minioadmin`, Keycloak `admin`) | Élevée (si déployé tel quel) | Secrets forts via Vaultwarden / Docker secrets ; le démarrage **bloque déjà** en prod si PII_MASKING off ou dev-login actif |
| R2 | Dev-login (jetons non signés) actif hors prod | Moyenne | Acceptable en dev ; **hard-désactivé en prod** (`ALLOW_DEV_LOGIN=false`, garde fatale au boot) |
| R3 | Tokens stockés en `localStorage` (front) | Moyenne | Migrer vers cookies `httpOnly`/`SameSite` si exposition publique |
| R4 | Rate limiting limité au chat (pas sur l'auth/REST) | Moyenne | Étendre le quota aux routes d'auth/REST |
| R5 | Pas d'observabilité centralisée (SIEM/metrics) | Moyenne | Logging structuré + métriques (Prometheus/Grafana/Loki) |
| R6 | Audit `append-only` par convention (pas d'immuabilité SGBD) | Faible | Contrainte/append-only au niveau base ou export WORM |
| R7 | Pentest automatisé partiel (pas de scan ZAP outillé) | Faible | Intégrer OWASP ZAP en CI (cf. [RAPPORT_PENTEST.md](RAPPORT_PENTEST.md)) |

## 5. Vérification continue
La suite `pytest` ([backend/tests](../backend/tests)) rejoue à chaque CI : RBAC par rôle, IDOR/scope (manager hors équipe → 404), anti-injection, masquage PII, refus d'accès sensible, non-fuite self-service, exclusion par consentement, chiffrement des messages, anonymisation. CI : [.github/workflows/tests.yml](../.github/workflows/tests.yml) + Semgrep (SAST) + Trivy (images).
