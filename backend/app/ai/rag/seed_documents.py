from app.ai.rag.vector_store import VectorStore


SEED_DOCUMENTS = [
    {
        "id": "rh_conges_001",
        "text": "Les demandes de congés doivent être déposées dans l'outil RH au moins 7 jours avant la date souhaitée, sauf urgence validée par le manager.",
        "metadata": {
            "title": "Politique des congés",
            "type": "policy",
            "allowed_roles": "all,collaborateur,manager,rh,direction",
            "department": "all",
            "confidentiality": "internal",
            "version": "1.0",
        },
    },
    {
        "id": "rh_absence_001",
        "text": "Toute absence imprévue doit être signalée au manager dès que possible puis régularisée avec un justificatif dans les 48 heures.",
        "metadata": {
            "title": "Procédure d'absence",
            "type": "procedure",
            "allowed_roles": "all,collaborateur,manager,rh,direction",
            "department": "all",
            "confidentiality": "internal",
            "version": "1.0",
        },
    },
    {
        "id": "rh_onboarding_001",
        "text": "Le guide onboarding couvre la préparation du matériel, la création des accès, la réunion d'accueil et le plan de formation des 30 premiers jours.",
        "metadata": {
            "title": "Guide onboarding",
            "type": "guide",
            "allowed_roles": "manager,rh",
            "department": "all",
            "confidentiality": "restricted",
            "version": "1.0",
        },
    },
    {
        "id": "rh_offboarding_001",
        "text": "La procédure offboarding impose la désactivation des accès, la restitution du matériel, l'entretien de départ et l'archivage des documents RH.",
        "metadata": {
            "title": "Procédure offboarding",
            "type": "procedure",
            "allowed_roles": "rh",
            "department": "all",
            "confidentiality": "restricted",
            "version": "1.0",
        },
    },
    {
        "id": "rh_teletravail_001",
        "text": "Le télétravail est autorisé jusqu'à deux jours par semaine selon l'accord du manager et les contraintes du poste.",
        "metadata": {
            "title": "Règles de télétravail",
            "type": "policy",
            "allowed_roles": "all,collaborateur,manager,rh,direction",
            "department": "all",
            "confidentiality": "internal",
            "version": "1.0",
        },
    },
    {
        "id": "rh_attestation_001",
        "text": "Les attestations standards peuvent être demandées par le collaborateur depuis le portail RH. Les attestations spécifiques nécessitent validation RH.",
        "metadata": {
            "title": "Génération d'attestation",
            "type": "procedure",
            "allowed_roles": "all,collaborateur,rh",
            "department": "all",
            "confidentiality": "internal",
            "version": "1.0",
        },
    },
]


def seed_documents() -> None:
    vector_store = VectorStore()
    for document in SEED_DOCUMENTS:
        vector_store.add_document(
            document_id=document["id"],
            text=document["text"],
            metadata=document["metadata"],
        )
    print(f"Seeded {len(SEED_DOCUMENTS)} HR documents into ChromaDB.")


if __name__ == "__main__":
    seed_documents()
