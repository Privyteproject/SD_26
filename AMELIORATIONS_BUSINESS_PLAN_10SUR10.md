# Synapse Digital — Business Plan : feuille de route vers 10/10 (localisée)

> Pour chaque point : **OÙ** l'appliquer (section + page du BP actuel), l'**ACTION** ([CORRIGER] /
> [REMPLACER] / [AJOUTER]) et le **contenu** prêt à coller. Pagination basée sur le PDF « Business Plan (1).pdf » (49 p.).

---

## 1. Corrections obligatoires (erreurs factuelles)

| # | OÙ (section · page) | Action | Correction |
|---|---|---|---|
| 1 | §10.4 *Perspectives financières*, tableau · **p.35** + §10.7.2 tableau ROI · **p.44** | CORRIGER | Résultat net 2026 : 650 000 − 1 500 000 = **−850 000** (pas −500 000) ; recalculer cumul/ROI |
| 2 | §10.4 tableau (« Évolution +120 % ») · **p.35** + §10.7.2 (« +160 % ») · **p.44** | CORRIGER | Croissance an 2 = **+238 %** (650 k → 2,2 M), une seule valeur |
| 3 | §8.5.3 SOM · **p.23-24**, §10.4 tableau · **p.35**, §10.5.3 · **p.40** | REMPLACER | Supprimer « ARR ≈ 900 000 » → adopter le modèle unique du §2 ci-dessous (ARR fin 2026 = **1,95 M**) |
| 4 | §10.4.3 *Indicateurs SaaS* (LTV) + tableau synthèse · **p.38** | CORRIGER | Une seule LTV : **~42 000 MAD** (supprimer 64 800 / 45 000 / 28 000) |
| 5 | §10.4.3 ratio LTV/CAC · **p.38** | CORRIGER | **~21x** (42 000 / 2 000), pas 26x |
| 6 | §10.4.3 churn + durée de vie · **p.38** | CORRIGER | Un seul jeu : churn **25 %/an** ↔ durée **4 ans** (1/0,25) ; supprimer le « 22 % » et les durées 2,5/2 ans |
| 7 | §2 Sommaire exécutif · **p.3** ; §10.1 · **p.28** ; §10.3 tableau · **p.32** ; §10.7.1 · **p.43** | CORRIGER | **Un seul montant de capital** partout (retenu : **1 500 000 MAD**) |
| 8 | §8.5.3 SOM + tableau TAM/SAM/SOM · **p.24** | CORRIGER | « 900 000 **M** MAD » → « 900 000 MAD » (le « M » = milliards) — 2 occurrences |
| 9 | §10.4.2 (320 clients) · **p.36** + §10.5.3 (650 clients) · **p.40** | CORRIGER | Un seul nombre de clients an 2 = **350** (dérivé du §2) |
| 10 | §10.1.1 méthode Berkus · **p.28** | CORRIGER | « premiers clients pilotes validés : 1 500 000 » → **0** tant qu'il n'y a pas de pilotes (ou sécuriser de vrais pilotes, cf. §3.5) |
| 11 | §10.7.4 (« interface en français et en arabe ») · **p.45** | CORRIGER | Le produit est **FR/EN** → écrire « français et anglais » (ou livrer l'arabe) |
| 12 | §11 Plans futurs (« passage à des embeddings réels ») · **p.47** | CORRIGER | L'app utilise **déjà** de vrais embeddings (sentence-transformers) → reformuler en « embeddings spécialisés / fine-tunés » |

---

## 2. Modèle financier réconcilié (remplace les tableaux financiers actuels)

### 2.1 Encadré « Hypothèses clés »
**OÙ :** insérer en tête de §10.1 *Besoin en capital* · **p.28**. **ACTION : [AJOUTER].**

| Hypothèse | Valeur | Justification |
|---|---|---|
| ARPU mixte | **13 000 MAD/client/an** | Mix 95 Essentiel (9 000) / 45 Pro (16 200) / 10 Enterprise (45 000) |
| Clients actifs fin d'année | 150 / 350 / 600 / 900 / 1 300 | Casa-Settat an 1 → national |
| Churn logo annuel | 25 % → 18 % → 12 % | ≈ 2,4 / 1,6 / 1,1 %/mois |
| Marge brute | ~80 % | Coût variable IA+cloud ≈ 20 % |
| CAC | 2 000 MAD (complet ~3 200) | 300 000 mkg / 150 clients |
| Conversion démo → signature | 10–15 % | Benchmark SaaS B2B peu mature |

> Règle d'or à écrire noir sur blanc : **CA = revenu reconnu sur l'année ; ARR = MRR de fin d'année × 12.**

### 2.2 Tableau financier 5 ans
**OÙ :** remplace le tableau de §10.4 · **p.35** et celui de §10.7.2 · **p.44**. **ACTION : [REMPLACER].**

| Année | Clients actifs | ARR fin (×13 000) | CA reconnu (ramp) | Dépenses | Résultat net | Cumul | ROI /1,5 M |
|---|---|---|---|---|---|---|---|
| 2026 | 150 | 1,95 M | ~0,95 M | 1,55 M | −0,60 M | −0,60 M | −39 % |
| 2027 | 350 | 4,55 M | 3,25 M | 2,60 M | +0,65 M | +0,05 M | +3 % |
| 2028 | 600 | 7,80 M | 6,20 M | 4,50 M | +1,70 M | +1,75 M | +113 % |
| 2029 | 900 | 11,70 M | 9,75 M | 7,00 M | +2,75 M | +4,50 M | +290 % |
| 2030 | 1 300 | 16,90 M | 14,30 M | 10,50 M | +3,80 M | +8,30 M | **+535 %** |

Profitabilité dès l'an 2 ; capital remboursé courant an 3.

### 2.3 Métriques SaaS (un seul jeu)
**OÙ :** remplace §10.4.3 *Indicateurs SaaS* · **p.37-38**. **ACTION : [REMPLACER].**

| Indicateur | Valeur | Formule |
|---|---|---|
| Churn annuel | 25 % (an 1) → <2 %/mois (an 2) | logo churn |
| LTV | **~42 000 MAD** | ARPU × marge / churn = 13 000 × 0,80 / 0,25 |
| CAC | 2 000 MAD (complet ~3 200) | inclure une part salaires commerciaux |
| LTV/CAC | **~21x** (~13x complet) | seuil sain > 3x |
| Payback CAC | **~2,3 mois** | CAC / (MRR × marge) |
| Marge brute | ~80 % | après LLM + cloud |

### 2.4 Analyse de sensibilité (3 scénarios chiffrés)
**OÙ :** §10.7.3 *Scénarios* · **p.45** (aujourd'hui qualitatif). **ACTION : [REMPLACER] par du chiffré.**

| Scénario | Hypothèse clé | ARR 2030 | ROI cumulé 5 ans |
|---|---|---|---|
| Prudent | adoption lente, churn 30 % | ~10 M | ~+300 % |
| **Central** | trajectoire §2.2 | ~17 M | ~+535 % |
| Optimiste | expansion régionale + modules paie/ATS | ~25 M | ~+800 % |

---

## 3. Sections à ajouter / renforcer

### 3.1 Matrice concurrentielle
**OÙ :** §7.7 *Paysage concurrentiel* · **p.18-19** (ou fin de §7.1). **ACTION : [AJOUTER] un tableau.**

| Critère | Synapse | Sage Maroc | Humantal | monday.com | RemotePass |
|---|---|---|---|---|---|
| Conformité 09-08 native | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assistant IA RAG (docs internes) | ✅ | ❌ | ❌ | ~ | ❌ |
| Analytique prédictive | ✅ | ❌ | ❌ | ~ | ❌ |
| Génération documentaire | ✅ | ~ | ~ | ❌ | ✅ |
| On/offboarding suivi | ✅ | ~ | ❌ | ✅ | ✅ |
| Masquage PII + audit | ✅ | ~ | ~ | ~ | ~ |
| Prix /emp/mois | 25–75 MAD | élevé | moyen | devise | élevé |
| UX + langue locale | ✅ | ❌ | ~ | ❌ | ✅ |
| Paie native | ❌ (roadmap) | ✅ | ✅ | ❌ | ✅ |
| Mobile | ~ (roadmap) | ~ | ❌ | ✅ | ✅ |

Légende : ✅ natif · ~ partiel · ❌ absent.

### 3.2 Registre des risques
**OÙ :** §10.7.4 *Facteurs / gestion des risques* · **p.45** (formaliser en tableau). **ACTION : [REMPLACER] le texte par un tableau.**

| Risque | Proba | Impact | Mitigation |
|---|---|---|---|
| Adoption lente PME | Élevée | Élevé | Essentiel 25 MAD, POC gratuits, onboarding accompagné |
| Dépendance LLM (OpenRouter) | Moyenne | Moyen | Fallback multi-modèles, quota/client, masquage PII |
| Cycle de vente B2B long | Élevée | Moyen | Canal partenaires, démos ciblées |
| Réplication concurrent | Moyenne | Élevé | Avance IA, switching cost données, exclusivités |
| Réglementaire CNDP/09-08 | Faible | Élevé | Veille, DPA, hébergement conforme |
| Faille / fuite de données | Faible | Très élevé | Chiffrement repos, RBAC, audit, pentest |
| Churn early > prévu | Moyenne | Élevé | Customer success, NPS, modules paie/ATS |
| Recrutement profils rares | Moyenne | Moyen | Equity, freelances, réseau Ynov |

### 3.3 Cap table + pool ESOP
**OÙ :** §10.1.1 *Structure de l'investissement* · **p.28-29**. **ACTION : [REMPLACER] le « 80 % fondateurs / 20 % investisseurs ».**

| Partie | Part post-money |
|---|---|
| Équipe fondatrice (9) | 73 % |
| Investisseurs amorçage | 20 % |
| Pool ESOP (recrutements futurs) | 7 % |

### 3.4 Emploi des fonds daté (Gantt 12 mois)
**OÙ :** sous §10.3 *Détail par poste* · **p.32**. **ACTION : [AJOUTER].**

| Poste | Montant | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| Développement produit | 720 k | ●● | ●● | ● | ● |
| Infra IA & cloud | 215 k | ● | ● | ● | ● |
| Marketing & vente B2B | 300 k | ● | ●● | ●● | ●● |
| Fonctionnement | 225 k | ● | ● | ● | ● |
| Réserve imprévus | 90 k | | | ● | ● |

### 3.5 Preuves de traction (LE levier décisif)
**OÙ :** nouvelle sous-section **§4.4 bis « Traction »** après §4 · **p.9**, + mention dans §2 Sommaire exécutif · **p.3**, + annexe LOI. **ACTION : [AJOUTER].**

À obtenir avant le jury : **3 design partners/pilotes**, **lettres d'intention (LOI)**, **discovery** (« X DRH interrogés, Y % sur Excel, Z % prêts à payer < 50 MAD/emp. »), **démo live** (atout : le produit tourne déjà → captures + lien), KPIs (liste d'attente, nb démos).

**Modèle de LOI (annexe) :**
> « La société [X], représentée par [Y], confirme son intérêt pour Synapse Digital et s'engage à
> participer à un pilote de [N] semaines à compter de [date], avec intention de souscription à la
> formule [Pro/Enterprise] sous réserve de validation des fonctionnalités. »

### 3.6 Go-to-market : cycle de vente
**OÙ :** §9.2 *Taux de conversion* · **p.27** (compléter le funnel existant). **ACTION : [AJOUTER].**
- Cycle de vente : **6–10 sem.** (PME) / **3–5 mois** (Enterprise).
- Définitions MQL / SQL / Win.
- Objectif partenaires : **8–10 cabinets** RH/comptables an 1.

### 3.7 Stratégie de sortie
**OÙ :** §10.7.5 *Intérêt pour les investisseurs* · **p.46**. **ACTION : [AJOUTER].**
- Acquéreurs : Sage, Cegid, ERP régionaux, PE, acteurs panafricains.
- Multiple : 4–6× ARR → à ARR ~17 M (2030), valorisation indicative **70–100 M MAD**.
- Horizon 5–7 ans ; alternative Série A (5–15 M MAD).

### 3.8 Conformité concrète
**OÙ :** §4.3 *IA éthique et protection des données* · **p.8-9**. **ACTION : [AJOUTER] des éléments factuels.**
- Localisation des données (Maroc/UE) + sous-traitant hébergeur.
- Statut déclaration **CNDP** (faite / en cours).
- **DPA** type avec les clients.
- Mesures : chiffrement au repos, RBAC/ABAC, masquage PII, journal d'audit, **purge/rétention automatique des logs**, ZDR côté LLM.

### 3.9 Glossaire
**OÙ :** annexe après la **Bibliographie** · **p.49**. **ACTION : [AJOUTER].**
ARR, MRR, CAC, LTV, churn, payback, RAG, RBAC/ABAC, PII, ZDR, TAM/SAM/SOM, ARPU, ESOP.

---

## 4. Forme et relecture (par page)
- **p.2** : « Synapse Digital**e** » → « Synapse Digital » (aussi p.47).
- **p.3** : « repartition **Claire** » → « répartition claire ».
- **p.24** : « 900 000 **M** MAD » (×2) → « 900 000 MAD ».
- **p.37** : titre « 10.4.3 **Ii**ndicateurs » → « Indicateurs ».
- **p.40** : « la formul**ro** » → « la formule ».
- **Global** : devise uniforme « 1 500 000 MAD » ; **deux titres « 9.2 »** (p.25 et p.27) → renuméroter le second en **9.3** ; légende + source sous chaque tableau/graphe.

---

## 5. Récapitulatif — qu'est-ce qui fait le 10/10 ?
1. **Cohérence financière parfaite** (§1 + §2) — zéro contradiction. → décisif
2. **Sections investisseur complètes** (§3.1-3.4, 3.7) : sensibilité chiffrée, risques, cap table + ESOP, sortie.
3. **Preuve de traction réelle + démo live** (§3.5) — seul point qui dépend du terrain.
4. **Forme irréprochable** (§4).

> Les blocs 1, 2, 3 (hors traction) et 4 sont 100 % réalisables sur dossier avec ce fichier.
> Le bloc **3.5 (traction)** scelle le 10/10 — et tu as un atout rare : **le produit fonctionne déjà**, donc 2-3 pilotes + une démo live suffisent.
