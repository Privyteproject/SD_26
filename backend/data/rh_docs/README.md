Place the RH source documents for ChromaDB ingestion in this folder.

Supported formats:
- `.json`: one object or a list of objects
- `.jsonl`: one JSON document per line
- `.md`
- `.txt`

Expected JSON fields:
- `id` or `document_id`
- `text`
- optional metadata: `title`, `type`, `allowed_roles`, `department`, `confidentiality`, `version`

Examples:
- `politiques_rh.json`
- `workflows_rh.jsonl`
- `attestations_internes_rh.json`
- `procedures_administratives_reelles_cnss.jsonl`

Source notes:
- `attestations_internes_rh.json` contains internal RH process documents written to improve
  retrieval quality for employee requests about work certificates, employer attestations,
  and administrative supporting documents.
- `procedures_administratives_reelles_cnss.jsonl` is a normalized subset derived from the public spreadsheet
  `liste-procedures-administratives-fr.xlsx` from `service-public.ma`.
  The selected rows are relevant to employee attestations, work attestations, salary declarations,
  and family-allocation procedures.

Run the ingestion:

```bash
cd backend
python -m app.ai.rag.ingest_documents
```
