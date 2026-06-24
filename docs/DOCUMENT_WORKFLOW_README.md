# Guide d'Intégration du Nouveau Workflow Documentaire (Binaire `.docx` / `.pdf`)

Ce document décrit les modifications apportées pour remplacer l'ancienne saisie de templates HTML / Jinja (via Monaco Editor) par un système robuste de gestion de modèles binaires Word (`.docx`) et PDF Formulaires Remplissables (`.pdf`).

---

## 🛠️ Dépendances & Configuration

### 1. Python (Backend)
Ajout de la bibliothèque `python-docx` pour manipuler et injecter des variables dans les documents Word.

* **Fichier :** `backend/requirements.txt`
  ```text
  python-docx>=1.1.0
  ```
* **Fichier :** `docker-compose.yml` (commande de démarrage du backend)
  ```yaml
  command: sh -c "pip install python-keycloak redis minio jinja2 python-docx && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
  ```

---

## 🗄️ Base de Données (Sans Migration Alembic)

Pour éviter de casser les environnements existants avec une migration de base de données, les métadonnées et la sauvegarde des modèles binaires sont encapsulées sous format JSON dans la colonne textuelle `gabarit` existante de la table `modele_document`.

### Structure du JSON stocké dans `gabarit` :
```json
{
  "is_binary": true,
  "format": "docx", // ou "pdf"
  "filename": "attestation_travail.docx",
  "minio_key": "templates/ATTEST_TRAVAIL.docx",
  "content_b64": "..." // Données binaires brutes encodées en Base64 (repli si MinIO indisponible)
}
```

* **Sérialisation (`backend/app/db/models.py`)** :
  La méthode `to_dict()` de `ModeleDocument` intercepte si le contenu de `gabarit` est un JSON binaire pour exposer les attributs `is_binary`, `format` et `filename` au frontend, tout en filtrant le lourd attribut `content_b64` pour économiser la bande passante.

---

## ⚙️ Couche Service (`backend/app/services/doc_preview.py`)

Les services clés implémentés pour manipuler les fichiers binaires :

1. **Remplissage Word (`fill_docx_template`)** :
   * Charge le fichier `.docx` via `python-docx`.
   * Parcourt l'ensemble des paragraphes et des cellules de tableaux à la recherche de tags de type `{{ employee.nom }}`.
   * Utilise le moteur Jinja pour interpoler les variables au sein de la première portion de texte (`run`) d'un paragraphe et vide les portions suivantes pour préserver le style (couleurs, polices, gras) défini dans le template d'origine.
2. **Remplissage PDF Form (`fill_pdf_template`)** :
   * Lit les formulaires PDF AcroForm via `pypdf.PdfReader` et `PdfWriter`.
   * Remplit les valeurs de champs de formulaire et les aplatit (`flatten=True`) pour empêcher toute édition ultérieure.
3. **Résolution Dynamique de Variables (`resolve_context_value`)** :
   * Mappe automatiquement les champs de formulaires PDF vers les données de l'employé en gérant :
     * La notation pointée (`employee.nom`)
     * La notation snake_case (`employee_nom`)
     * Le cas d'insensibilité à la casse.
     * Le cas d'unification du nom complet (`employee.nom_complet` -> résout `Prenom Nom`).
4. **Génération de Rendu HTML d'Aperçu (`docx_to_html_preview`)** :
   * Extrait et met en page le contenu brut textuel et tabulaire d'un Word dans un format HTML épuré, centré et stylisé pour simuler un rendu A4.

---

## 🔌 API Endpoints (`backend/app/api/v1/endpoints/documents.py`)

* **`POST /modeles/{code}/upload` (Nouveau)** :
  * Reçoit le fichier par `UploadFile`.
  * Valide l'extension (`.docx`, `.pdf`) et l'intégrité structurelle du document à la volée.
  * Stocke le binaire dans MinIO (`templates/{code}.{ext}`) et sauvegarde la structure JSON dans `gabarit` avec un repli Base64.
* **`GET /preview/pdf` & `GET /preview/download` (Nouveau)** :
  * Génèrent et servent à la volée le flux binaire pre-rempli pour l'iframe de prévisualisation (format PDF inline) ou le téléchargement local (Word / PDF).
  * Les informations de preview sont sécurisées via un token Redis d'une durée de vie limitée (TTL).
* **`POST /submit` & `BackgroundTasks` (Modifiés)** :
  * Si le template est binaire, le PDF ou Word rempli est généré de manière synchrone lors de la soumission et téléversé directement dans MinIO (chemin `hr-documents/{uid}/{doc_id}/{filename}`). Le traitement en arrière-plan est alors ignoré pour éviter les doublons.

---

## 🎨 Frontend (React)

### 1. Client d'API (`frontend/src/lib/api.js`)
* Modification de la fonction `request` pour ne pas forcer le header `Content-Type: application/json` lorsque le payload est une instance de `FormData` (laissant le navigateur définir les frontières de fichiers `boundary`).
* Ajout de `uploadDocumentModeleFile(code, file)`.

### 2. Espace RH (`frontend/src/features/documents/pages/DocumentsRh.jsx`)
* Remplacement complet de Monaco Editor par une zone de glisser-déposer de fichiers (`.docx`, `.pdf`).
* Ajout d'une barre latérale avec des badges cliquables pour copier instantanément les variables autorisées dans le presse-papiers.

### 3. Modal de Visualisation (`frontend/src/features/documents/pages/DocumentPreviewModal.jsx`)
* **Hauteur Maximale et Centrage** : La modal occupe désormais toute la hauteur de l'écran (`height: "100vh"`) et supprime les paddings internes du document pour afficher l'iframe sans bordure.
* **Rendu Isolé par `srcDoc`** : L'aperçu HTML (Word traduits ou templates HTML) est chargé via un iframe isolé avec l'attribut `srcDoc` pour éviter toute fuite ou pollution de styles CSS avec l'interface principale.
* **Rendu PDF Auto-ajusté** : Les iframes PDF ciblent l'endpoint avec le paramètre d'affichage `#toolbar=0&navpanes=0&view=Fit` pour forcer le lecteur du navigateur à masquer ses barres et ajuster automatiquement le zoom de la page A4.
* **Règle de téléchargement** : Le bouton **Télécharger** d'aperçu est masqué si le document requiert une approbation RH (`requires_rh_validation: true`).
