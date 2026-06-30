"""Seed des données sensibles pour les comptes de démonstration (EMP001..EMP008).

Permet au moteur E5 de répondre aux questions « contrat / dossier / salaire / fiche de
paie de <collaborateur> » sur les comptes démo (Sofia Alami, Karim Benali, etc.) :
- HistoriqueSalaire (dernier salaire) ;
- DossierConfidentiel (CIN + adresse, CHIFFRÉS au repos via crypto) ;
- Document CONTRAT (clauses en TEXTE -> restituables dans le chat aux profils autorisés) ;
- Document FICHE_PAIE (PDF MinIO -> listé, à télécharger).

Idempotent : purge les données sensibles existantes de ces matricules puis les recrée.

    docker compose exec backend python -m app.db.seed_demo_sensitive
"""

from datetime import date

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import Document, DossierConfidentiel, Employe, HistoriqueSalaire
from app.services import crypto

# Salaire mensuel indicatif par matricule démo (MAD).
SALAIRES = {
    "EMP001": 28000, "EMP002": 22000, "EMP003": 18000, "EMP004": 32000,
    "EMP005": 12000, "EMP006": 15000, "EMP007": 26000, "EMP008": 14000,
}


def _contrat_texte(emp, salaire) -> str:
    debut = emp.date_embauche.strftime("%d/%m/%Y") if emp.date_embauche else "—"
    return (
        f"CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE\n"
        f"Entre Synapse Digital (l'employeur) et {emp.prenom} {emp.nom} (le salarié).\n\n"
        f"Article 1 — Engagement : le salarié est engagé au poste de « {emp.poste or '—'} » "
        f"à compter du {debut}.\n"
        f"Article 2 — Période d'essai : 3 mois, renouvelable une fois.\n"
        f"Article 3 — Rémunération : salaire mensuel brut de {salaire:,.0f} MAD, versé mensuellement.\n"
        f"Article 4 — Durée du travail : 44 heures hebdomadaires, du lundi au vendredi.\n"
        f"Article 5 — Congés payés : 1,5 jour ouvrable par mois de travail effectif.\n"
        f"Article 6 — Confidentialité : le salarié s'engage à la stricte confidentialité "
        f"des informations de l'entreprise et des données personnelles traitées.\n"
        f"Article 7 — Préavis : conforme à la convention collective et au Code du travail marocain.\n"
        f"Article 8 — Protection des données (loi 09-08) : les données du salarié sont traitées "
        f"de façon confidentielle et sécurisée."
    )


def run():
    db = SessionLocal()
    try:
        emps = list(db.scalars(select(Employe).where(Employe.matricule.in_(list(SALAIRES)))))
        if not emps:
            print("Aucun compte démo EMP001..EMP008 trouvé. Lance d'abord le seed de base.")
            return

        mats = [e.matricule for e in emps]
        # Purge des données sensibles existantes de ces matricules.
        db.execute(delete(Document).where(Document.matricule.in_(mats),
                   Document.type_doc.in_(["CONTRAT", "FICHE_PAIE"])))
        db.execute(delete(DossierConfidentiel).where(DossierConfidentiel.matricule.in_(mats)))
        db.execute(delete(HistoriqueSalaire).where(HistoriqueSalaire.matricule.in_(mats)))
        db.commit()

        for e in emps:
            salaire = SALAIRES.get(e.matricule, 15000)
            db.add(HistoriqueSalaire(matricule=e.matricule, montant=salaire,
                                     date_effet=e.date_embauche or date(2024, 1, 1), motif="Embauche"))
            db.add(DossierConfidentiel(
                matricule=e.matricule,
                cin=crypto.encrypt(f"BK{e.matricule[-3:]}456"),
                adresse=crypto.encrypt(f"{e.matricule[-2:]} rue de l'Innovation, Casablanca")))
            db.add(Document(matricule=e.matricule, nom_fichier=f"contrat_{e.matricule}.txt",
                            type_doc="CONTRAT", statut="validated",
                            contenu=_contrat_texte(e, salaire)))
            db.add(Document(matricule=e.matricule, nom_fichier=f"fiche_paie_{e.matricule}_2026_05.pdf",
                            type_doc="FICHE_PAIE", statut="validated",
                            cle_minio=f"hr-documents/{e.matricule}/fiche_paie_2026_05.pdf"))
        db.commit()
        print(f"OK — données sensibles créées pour {len(emps)} comptes démo : {', '.join(mats)}")
        print("  • Contrat (clauses en texte, restituable), fiche de paie (PDF), salaire, dossier (CIN/adresse chiffrés).")
    finally:
        db.close()


if __name__ == "__main__":
    run()
