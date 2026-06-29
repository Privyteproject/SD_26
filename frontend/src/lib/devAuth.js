// Dev-login local (repli quand Keycloak n'est pas lancé).
//
// Forge un JWT « non vérifié » porteur des mêmes claims que ceux émis par
// Keycloak (sub, email, name, realm_access.roles). Le backend l'accepte en
// développement car AUTH_VERIFY_SIGNATURE=false (cf. backend core/security.py :
// il décode les claims sans vérifier la signature). La signature ici est donc
// un simple marqueur ("dev") — JAMAIS de secret, JAMAIS à activer en production.
//
// Les e-mails correspondent EXACTEMENT aux comptes semés par le backend
// (db/seed_demo_accounts.py, domaine @waminey.ma) afin que GET /employees/me
// renvoie un profil complet (matricule, département, équipe…) et que le scoping
// par rôle fonctionne. Source unique partagée avec authStore.js.

export const DEMO_PASSWORD = "demo1234";

// Compte de démo -> rôle realm Keycloak (minuscule) attendu par le mapping back/front.
export const DEV_ACCOUNTS = [
  { email: "admin@waminey.ma",         name: "Mohammed El Idrissi", realmRole: "admin",         role: "ADMIN" },
  { email: "direction@waminey.ma",     name: "Nadia Benjelloun",    realmRole: "direction",     role: "DIRECTION" },
  { email: "rh@waminey.ma",            name: "Karim Benali",        realmRole: "rh",            role: "RH" },
  { email: "manager@waminey.ma",       name: "Sofia Alami",         realmRole: "manager",       role: "MANAGER" },
  { email: "medecine@waminey.ma",      name: "Yasmine Saidi",       realmRole: "medecine",      role: "MEDECINE" },
  { email: "collaborateur@waminey.ma", name: "Hamza Cherkaoui",     realmRole: "collaborateur", role: "COLLABORATEUR" },
  { email: "nouveau@waminey.ma",       name: "Adam Tazi",           realmRole: "collaborateur", role: "COLLABORATEUR" },
  { email: "depart@waminey.ma",        name: "Lina Haddad",         realmRole: "collaborateur", role: "COLLABORATEUR" },
];

function findAccount(email) {
  const e = (email || "").trim().toLowerCase();
  return DEV_ACCOUNTS.find((a) => a.email === e) || null;
}

// Encodage base64url d'un objet JSON (compatible UTF-8).
function b64url(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isDevAccount(email) {
  return !!findAccount(email);
}

// Construit un faux JWT (header.payload.signature) pour un compte de démo connu.
// Renvoie null si l'e-mail n'est pas un compte de démo.
export function mintDevToken(email) {
  const acc = findAccount(email);
  if (!acc) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({
    sub: `dev-${acc.email}`,
    email: acc.email,
    name: acc.name,
    preferred_username: acc.email,
    realm_access: { roles: [acc.realmRole] },
    iat: now,
    exp: now + 60 * 60 * 12, // 12 h (le backend ne vérifie pas l'exp en dev)
  });
  return `${header}.${payload}.dev`;
}
