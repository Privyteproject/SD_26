/**
 * useKpi — Synapse Digital
 * Fetch les KPIs depuis l'API avec fallback démo si backend absent.
 * Retourne { data, loading, error, refetch }
 */
import { useState, useEffect, useCallback } from "react";
import { useApi, API } from "./useApi";

// ── Données démo (fallback si API indisponible) ───────────────────────────────
const DEMO_COLLAB = {
  congesRestants:   18,
  absencesMois:      2,
  formationsOk:      4,
  formationsTotal:   6,
  scoreEngagement:  87,
  notifications: [
    { type: "info",    text: "Votre demande de congé a été approuvée",  time: "Il y a 2h" },
    { type: "warn",    text: "Entretien annuel planifié le 12/06",       time: "Il y a 1j" },
    { type: "success", text: "Formation React certifiée complétée",      time: "Il y a 3j" },
  ],
  onboardingSteps: [
    { label: "Accueil & présentation",      done: true  },
    { label: "Outils & accès configurés",   done: true  },
    { label: "Formation sécurité",          done: true  },
    { label: "Rencontre équipe RH",         done: false },
    { label: "Premier entretien manager",   done: false },
  ],
  alertes: [
    { type: "warn",    msg: "Entretien annuel à planifier avant le 30 juin 2026.", action: "Planifier" },
    { type: "success", msg: "Votre attestation de travail est disponible.",         action: "Télécharger" },
    { type: "info",    msg: "Nouvelle politique de télétravail publiée.",           action: "Lire" },
  ],
};

const DEMO_RH = {
  effectifTotal:     148,
  effectifDelta:      +3,
  tauxAbsenteisme:   4.2,
  absenteismeDelta: -0.8,
  tauxTurnover:     12.1,
  turnoverDelta:     +1.2,
  alertesActives:      7,
  alertesDelta:        2,
  scoreEngagement:    74,
  repartitionEngagement: [
    { label: "Très engagés", pct: 32, color: null },
    { label: "Engagés",      pct: 42, color: null },
    { label: "Désengagés",   pct: 18, color: null },
    { label: "À risque",     pct:  8, color: null },
  ],
  absenteismeMensuel: [3.8, 4.0, 5.1, 4.6, 3.9, 4.2],
  absenteismeLabels:  ["Jan","Fév","Mar","Avr","Mai","Jun"],
  alertesDesengagement: [
    { name: "Sophie Martin", dept: "Tech",    risk: "Élevé", reason: "Absentéisme x3, entretien manqué",        score: 82 },
    { name: "Karim Benali",  dept: "Finance", risk: "Moyen", reason: "Baisse engagement enquête interne",        score: 61 },
    { name: "Laura Petit",   dept: "Marketing",risk:"Élevé", reason: "Arrêts maladie répétés, charge élevée",   score: 78 },
    { name: "Marc Durand",   dept: "RH",      risk: "Faible",reason: "Légère baisse satisfaction",              score: 38 },
  ],
};

const DEMO_ADMIN = {
  tentativesRefusees: 34,
  accesSuspects:       7,
  alertesCritiques:    3,
  sessionsActives:    42,
  alertes: [
    { id:"ALT-001", level:"Critique", user:"jean.dupont@corp.com",  role:"Collaborateur", action:"Tentative accès données paie (hors périmètre)",          time:"10:14:32", date:"03/06/2026", count:5, ip:"192.168.1.45"  },
    { id:"ALT-002", level:"Élevé",    user:"marc.durand@corp.com",  role:"Manager",       action:"Requête répétée dossiers médicaux collaborateurs",        time:"09:52:11", date:"03/06/2026", count:3, ip:"10.0.0.22"     },
    { id:"ALT-003", level:"Moyen",    user:"ali.hassan@corp.com",   role:"Collaborateur", action:"Prompt injection détectée sur assistant IA",              time:"08:30:05", date:"03/06/2026", count:1, ip:"192.168.2.10"  },
    { id:"ALT-004", level:"Faible",   user:"clara.martin@corp.com", role:"Stagiaire",     action:"Accès refusé : dossier hors département",                time:"07:15:44", date:"03/06/2026", count:2, ip:"10.0.0.88"     },
  ],
  logs: [
    { time:"10:22:15", user:"marie.rousseau@corp.com", action:"Connexion réussie",                    module:"Auth",    status:"OK"     },
    { time:"10:14:32", user:"jean.dupont@corp.com",    action:"Accès refusé — données paie",           module:"IA RH",   status:"REFUSÉ" },
    { time:"09:58:03", user:"sys@synapse",             action:"Backup base de données",               module:"Système", status:"OK"     },
    { time:"09:52:11", user:"marc.durand@corp.com",    action:"Accès refusé — dossiers médicaux",      module:"IA RH",   status:"REFUSÉ" },
    { time:"09:30:00", user:"admin@synapse",           action:"Mise à jour rôles utilisateurs",        module:"Admin",   status:"OK"     },
    { time:"08:45:20", user:"laura.petit@corp.com",    action:"Génération attestation de travail",     module:"Documents",status:"OK"   },
    { time:"08:30:05", user:"ali.hassan@corp.com",     action:"Prompt injection bloquée",              module:"Sécurité",status:"BLOQUÉ"},
    { time:"07:15:44", user:"clara.martin@corp.com",   action:"Accès refusé — dossier hors dept",     module:"IA RH",   status:"REFUSÉ" },
  ],
  roles: [
    { name:"Administrateurs", count:3,   perms:["Accès total","Config système","Logs complets"] },
    { name:"Équipes RH",      count:8,   perms:["Données RH","Dashboard","Documents"] },
    { name:"Managers",        count:24,  perms:["Dashboard équipe","Alertes équipe"] },
    { name:"Collaborateurs",  count:113, perms:["Données personnelles","Assistant IA limité"] },
  ],
};

// ── Hook générique ────────────────────────────────────────────────────────────
export function useKpiCollab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const api = useApi();

  const fetch = useCallback(async () => {
    setLoading(true);
    const res = await api.get(API.KPI_COLLAB);
    if (res.ok) {
      setData(res.data);
    } else {
      // Fallback démo silencieux
      setData(DEMO_COLLAB);
    }
    setError(res.ok ? null : null); // ne pas afficher d'erreur en démo
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useKpiRH() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  const fetch = useCallback(async () => {
    setLoading(true);
    const res = await api.get(API.KPI_RH);
    setData(res.ok ? res.data : DEMO_RH);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useKpiAdmin() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  const fetch = useCallback(async () => {
    setLoading(true);
    const res = await api.get(API.ADMIN_LOGS);
    const resAlerts = await api.get(API.ADMIN_ALERTS);
    if (res.ok && resAlerts.ok) {
      setData({ ...DEMO_ADMIN, logs: res.data, alertes: resAlerts.data });
    } else {
      setData(DEMO_ADMIN);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export { DEMO_COLLAB, DEMO_RH, DEMO_ADMIN };
