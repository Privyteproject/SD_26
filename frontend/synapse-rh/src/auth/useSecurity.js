/**
 * useSecurity — Synapse Digital (S4)
 * Protection XSS côté front :
 *  - sanitisation DOMPurify de tout input affiché dans le DOM
 *  - détection prompt injection dans les messages IA
 *  - validation des champs de formulaire
 *  - CSP helper (headers recommandés)
 */

import DOMPurify from "dompurify";

// ─── Sanitisation ─────────────────────────────────────────────────────────────
/**
 * Nettoie une chaîne avant injection dans le DOM.
 * À utiliser pour tout contenu provenant de l'API ou de l'utilisateur.
 */
export function sanitize(str) {
  if (typeof str !== "string") return "";
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ["b", "strong", "em", "i", "br", "p", "span"],
    ALLOWED_ATTR: ["style"],
  });
}

/** Sanitise un objet entier (récursivement sur les strings) */
export function sanitizeObject(obj) {
  if (typeof obj === "string") return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)]));
  }
  return obj;
}

// ─── Détection Prompt Injection ───────────────────────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(your\s+)?instructions/i,
  /you\s+are\s+now\s+(a\s+)?different/i,
  /pretend\s+you\s+(are|have)/i,
  /act\s+as\s+(if\s+you\s+are|a)/i,
  /system\s*:\s*(you|ignore|forget)/i,
  /\[\s*system\s*\]/i,
  /oublie\s+(tes|toutes\s+tes|les|toutes\s+les)\s+(instructions|règles)/i,
  /ignore\s+(les|tes|toutes\s+les)\s+instructions/i,
  /tu\s+es\s+maintenant/i,
  /fais\s+semblant\s+d['e]/i,
  /révèle\s+(tes|les|ton)\s+(instructions|prompt|system)/i,
  /montre\s+(moi|ton)\s+(prompt|system|instructions)/i,
  /<\s*script/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,  // onclick=, onload=, etc.
  /data\s*:\s*text\/html/i,
];

export function detectPromptInjection(text) {
  if (typeof text !== "string") return false;
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

// ─── Validation formulaires ───────────────────────────────────────────────────
export const validators = {
  email(v) {
    if (!v) return "L'email est requis.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Format email invalide.";
    return null;
  },
  password(v) {
    if (!v) return "Le mot de passe est requis.";
    if (v.length < 8) return "Minimum 8 caractères.";
    if (!/[A-Z]/.test(v)) return "Au moins une majuscule.";
    if (!/[0-9]/.test(v)) return "Au moins un chiffre.";
    return null;
  },
  passwordConfirm(v, original) {
    if (!v) return "Confirmez le mot de passe.";
    if (v !== original) return "Les mots de passe ne correspondent pas.";
    return null;
  },
  name(v) {
    if (!v || v.trim().length < 2) return "Nom trop court.";
    if (/[<>{}[\]]/.test(v)) return "Caractères non autorisés.";
    return null;
  },
  notEmpty(v, fieldName = "Ce champ") {
    if (!v || !v.trim()) return `${fieldName} est requis.`;
    return null;
  },
  // Anti XSS : bloque les injections HTML dans un champ texte libre
  safeText(v) {
    if (!v) return null;
    if (/<[^>]*>/.test(v)) return "Balises HTML non autorisées.";
    if (/[<>]/.test(v)) return "Caractères < > non autorisés.";
    return null;
  },
};

export function validateForm(fields) {
  // fields = { email: [value, [validator1, validator2]], ... }
  const errors = {};
  let valid = true;
  for (const [key, [value, fns]] of Object.entries(fields)) {
    for (const fn of fns) {
      const err = typeof fn === "function" ? fn(value) : null;
      if (err) { errors[key] = err; valid = false; break; }
    }
  }
  return { valid, errors };
}

// ─── CSP Helper ───────────────────────────────────────────────────────────────
/**
 * En production, ces headers doivent être définis côté serveur (nginx/express).
 * Ce helper sert à documenter + vérifier la config.
 */
export const CSP_DIRECTIVES = {
  "default-src":     ["'self'"],
  "script-src":      ["'self'"],
  "style-src":       ["'self'", "'unsafe-inline'"],
  "img-src":         ["'self'", "data:", "blob:"],
  "connect-src":     ["'self'", import.meta.env.VITE_API_URL || "http://localhost:8080",
                      import.meta.env.VITE_KC_URL || "http://localhost:8180"],
  "frame-ancestors": ["'none'"],
  "form-action":     ["'self'"],
};

export function buildCSPString() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useSecurity() {
  return {
    sanitize,
    sanitizeObject,
    detectPromptInjection,
    validators,
    validateForm,
  };
}
