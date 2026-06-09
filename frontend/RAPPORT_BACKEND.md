# RAPPORT — Ce qu'il manque côté Backend
## Synapse Digital · Plateforme IA RH · YDAYS 2026

---

## 1. Authentification & Keycloak

### Endpoints requis

| Méthode | URL | Corps | Réponse attendue |
|---------|-----|-------|-----------------|
| POST | `/api/auth/login` | `{ email, password }` | `{ accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |

> L'inscription est gérée par Keycloak Admin directement (pas d'endpoint register côté app, c'est une application interne).

### Configuration Keycloak obligatoire

```
Realm : synapse

Client : synapse-frontend
  - Client type       : OpenID Connect
  - Valid redirect URIs: http://localhost:5173/*, https://synapse.ma/*
  - Web origins       : http://localhost:5173, https://synapse.ma
  - Standard flow     : ON
  - Direct access     : OFF

Rôles realm à créer (exactement ces noms) :
  - collaborateur
  - manager
  - rh
  - direction
  - admin
```

### Format JWT attendu par le frontend

```json
{
  "sub": "uuid-utilisateur",
  "name": "Prénom Nom",
  "email": "prenom.nom@synapse.ma",
  "department": "Tech & Produit",
  "realm_access": {
    "roles": ["collaborateur"]
  },
  "exp": 1234567890,
  "iat": 1234567890
}
```

Le champ `realm_access.roles` est lu automatiquement par `AuthContext.jsx` pour déterminer les droits d'accès.

---

## 2. Dashboard Collaborateur

| Méthode | URL | Réponse attendue |
|---------|-----|-----------------|
| GET | `/api/kpi/collaborateur` | `{ congesRestants, absencesMois, formationsOk, formationsTotal, scoreEngagement, notifications[], onboardingSteps[], alertes[] }` |

### Structure `notifications[]`
```json
[{ "type": "info|warn|success", "text": "...", "time": "Il y a 2h" }]
```

### Structure `onboardingSteps[]`
```json
[{ "label": "Accueil & présentation", "done": true }]
```

### Structure `alertes[]`
```json
[{ "type": "warn", "msg": "Entretien annuel à planifier...", "action": "Planifier" }]
```

---

## 3. Dashboard RH / Manager

| Méthode | URL | Réponse attendue |
|---------|-----|-----------------|
| GET | `/api/kpi/rh` | Voir structure ci-dessous |

```json
{
  "effectifTotal": 148,
  "effectifDelta": 3,
  "tauxAbsenteisme": 4.2,
  "absenteismeDelta": -0.8,
  "tauxTurnover": 12.1,
  "turnoverDelta": 1.2,
  "alertesActives": 7,
  "alertesDelta": 2,
  "scoreEngagement": 74,
  "repartitionEngagement": [
    { "label": "Très engagés", "pct": 32 },
    { "label": "Engagés",      "pct": 42 },
    { "label": "Désengagés",   "pct": 18 },
    { "label": "À risque",     "pct": 8  }
  ],
  "absenteismeMensuel": [3.8, 4.0, 5.1, 4.6, 3.9, 4.2],
  "absenteismeLabels": ["Jan","Fév","Mar","Avr","Mai","Jun"],
  "alertesDesengagement": [
    {
      "name": "Sophie Martin",
      "dept": "Tech",
      "risk": "Élevé",
      "reason": "Absentéisme répété",
      "score": 82
    }
  ]
}
```

---

## 4. Dashboard Admin

| Méthode | URL | Réponse attendue |
|---------|-----|-----------------|
| GET | `/api/admin/logs` | `[{ time, user, action, module, status }]` |
| GET | `/api/admin/alerts` | `[{ id, level, user, role, action, time, date, count, ip }]` |
| GET | `/api/admin/roles` | `[{ name, count, perms[] }]` |

### Valeurs `status` pour les logs
`"OK"` | `"REFUSÉ"` | `"BLOQUÉ"`

### Valeurs `level` pour les alertes
`"Critique"` | `"Élevé"` | `"Moyen"` | `"Faible"`

---

## 5. Assistant IA RH

| Méthode | URL | Corps | Réponse |
|---------|-----|-------|---------|
| POST | `/api/ia/chat` | `{ message, history[] }` | `{ reply: "..." }` |
| GET | `/api/ia/chat/history` | — | `[{ role, content, time }]` |

### Structure `history[]`
```json
[
  { "role": "user",      "content": "Combien de congés..." },
  { "role": "assistant", "content": "Il vous reste 18 jours..." }
]
```

> Le frontend gère déjà la détection de prompt injection côté client. Le backend doit aussi valider côté serveur.

---

## 6. Génération de Documents

| Méthode | URL | Corps | Réponse |
|---------|-----|-------|---------|
| POST | `/api/documents/generate` | `{ type, fields: {} }` | `{ id, status, url? }` |
| GET | `/api/documents` | — | `[{ id, name, date, status, icon }]` |
| GET | `/api/documents/:id/pdf` | — | Fichier PDF (blob) |

### Valeurs `type`
`"attestation_travail"` | `"attestation_salaire"` | `"demande_conge"` | `"note_frais"` | `"demande_teletravail"` | `"mobilite_interne"`

### Valeurs `status`
`"Disponible"` | `"Approuvé"` | `"En cours"` | `"En attente"`

---

## 7. Onboarding

| Méthode | URL | Corps | Réponse |
|---------|-----|-------|---------|
| GET | `/api/onboarding/me` | — | Objet onboarding complet |
| PATCH | `/api/onboarding/steps/:id` | `{ done: boolean }` | `{ ok: true }` |

### Structure réponse GET
```json
{
  "currentDay": 5,
  "weeks": [
    {
      "week": "Semaine 1",
      "subtitle": "Découverte & installation",
      "days": "J1 → J5",
      "steps": [
        { "id": "w0s0", "label": "Accueil manager", "done": true, "day": "J1", "type": "rencontre" }
      ]
    }
  ],
  "contacts": [{ "name": "Marie Rousseau", "role": "RH", "avatar": "MR", "tag": "RH" }],
  "resources": [{ "icon": "📘", "label": "Guide collaborateur", "type": "PDF" }]
}
```

---

## 8. Offboarding

| Méthode | URL | Corps | Réponse |
|---------|-----|-------|---------|
| GET | `/api/offboarding/me` | — | Objet offboarding complet |
| PATCH | `/api/offboarding/steps/:id` | `{ done: boolean }` | `{ ok: true }` |
| POST | `/api/ia/synthese` | `{ userId }` | `{ content: "markdown..." }` |

### Structure réponse GET
```json
{
  "collaborateur": {
    "name": "Arush Ramisami",
    "poste": "Développeur Frontend",
    "dept": "Tech & Produit",
    "anciennete": "2 ans 9 mois",
    "depart": "30/06/2026",
    "type": "Démission"
  },
  "categories": [
    {
      "key": "documents",
      "label": "Documents administratifs",
      "icon": "📄",
      "color": "gold",
      "items": [{ "id": "d1", "label": "Lettre de démission reçue", "done": true }]
    }
  ],
  "documents": [
    { "id": "doc1", "icon": "📄", "label": "Attestation de travail", "status": "Prête" }
  ]
}
```

---

## 9. Profil Utilisateur

| Méthode | URL | Corps | Réponse |
|---------|-----|-------|---------|
| GET | `/api/profil/me` | — | Objet profil complet |
| PUT | `/api/profil/me` | Objet profil | `{ ok: true }` |
| PATCH | `/api/profil/password` | `{ current, newPassword }` | `{ ok: true }` |
| GET | `/api/profil/sessions` | — | `[{ device, location, time, current }]` |
| DELETE | `/api/profil/sessions/:id` | — | `{ ok: true }` |
| PATCH | `/api/profil/notifications` | `{ email, push, rh, alertes, onboarding }` | `{ ok: true }` |

### Structure réponse GET profil
```json
{
  "prenom": "Arush",
  "nom": "Ramisami",
  "email": "a.ramisami@synapse.ma",
  "telephone": "+212 6 00 00 00 00",
  "poste": "Développeur Frontend",
  "departement": "Tech & Produit",
  "localisation": "Casablanca, Maroc",
  "embauche": "01/09/2023"
}
```

---

## 10. Headers CORS requis

Le backend doit autoriser les origines suivantes :

```
Access-Control-Allow-Origin: http://localhost:5173 (dev), https://synapse.ma (prod)
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Expose-Headers: Authorization
```

---

## 11. Codes HTTP attendus par le frontend

| Code | Situation |
|------|-----------|
| 200 | Succès |
| 201 | Ressource créée (document généré) |
| 400 | Données invalides → `{ message: "..." }` |
| 401 | Token expiré ou invalide → frontend déclenche refresh |
| 403 | Rôle insuffisant → frontend redirige /403 |
| 404 | Ressource inexistante |
| 500 | Erreur serveur → `{ message: "Erreur interne" }` |

---

## 12. Résumé prioritaire pour le backend

```
CRITIQUE (bloque le login)
├── Keycloak : realm synapse + client synapse-frontend + 5 rôles
└── POST /api/auth/login → { accessToken, refreshToken }

HAUTE PRIORITÉ (bloque les dashboards)
├── GET /api/kpi/collaborateur
├── GET /api/kpi/rh
├── GET /api/admin/logs + /alerts
└── POST /api/ia/chat

NORMALE (fonctionnalités secondaires)
├── GET/POST /api/documents
├── GET/PATCH /api/onboarding
├── GET/PATCH /api/offboarding
└── GET/PUT /api/profil/me
```

