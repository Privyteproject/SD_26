// Accès Keycloak : login par mot de passe (Resource Owner Password Credentials, pratique en dev)
// et rafraîchissement silencieux du jeton.
//
// Repli « dev-login » : si Keycloak est injoignable (non lancé en local), on forge
// un jeton local accepté par le backend en dev (cf. lib/devAuth.js). Cela permet
// de tourner de bout en bout sans installer Keycloak. En prod, Keycloak répond et
// ce repli n'est jamais utilisé.
import { setTokens, getRefreshToken, getAccessToken, clearTokens, decodeJwt } from "./tokens";
import { mintDevToken, isDevAccount, DEMO_PASSWORD } from "./devAuth";

const KC_URL = import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080";
const REALM = import.meta.env.VITE_KEYCLOAK_REALM || "ydays";
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "frontend-app";
const TOKEN_URL = `${KC_URL}/realms/${REALM}/protocol/openid-connect/token`;

// Marqueur localStorage : la session courante a été ouverte via le repli dev-login.
const DEV_FLAG = "sd-dev-login";

async function tokenRequest(form) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) throw new Error("keycloak_token_failed");
  return res.json();
}

// Ouvre une session locale (dev-login) pour un compte de démo connu.
function devLogin(username, password) {
  const token = mintDevToken(username);
  if (!token || password !== DEMO_PASSWORD) throw new Error("dev_login_failed");
  setTokens({ access_token: token, refresh_token: token });
  try { localStorage.setItem(DEV_FLAG, "1"); } catch { /* ignore */ }
  return { access_token: token, refresh_token: token };
}

export async function loginWithPassword(username, password) {
  try {
    const data = await tokenRequest({
      grant_type: "password", client_id: CLIENT_ID, username, password, scope: "openid",
    });
    setTokens(data);
    try { localStorage.removeItem(DEV_FLAG); } catch { /* ignore */ }
    return data;
  } catch (err) {
    // Keycloak indisponible (ou identifiants refusés) : on tente le repli dev-login
    // pour les comptes de démonstration. Sinon on propage l'échec.
    if (isDevAccount(username)) return devLogin(username, password);
    throw err;
  }
}

export async function refreshTokens() {
  // Session dev-login : pas de vrai refresh -> on re-forge un jeton frais.
  let devLoginActive = false;
  try { devLoginActive = localStorage.getItem(DEV_FLAG) === "1"; } catch { /* ignore */ }
  if (devLoginActive) {
    const email = decodeJwt(getAccessToken())?.email;
    const token = email && mintDevToken(email);
    if (!token) throw new Error("dev_refresh_failed");
    setTokens({ access_token: token, refresh_token: token });
    return token;
  }

  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error("no_refresh_token");
  const data = await tokenRequest({
    grant_type: "refresh_token", client_id: CLIENT_ID, refresh_token,
  });
  setTokens(data);
  return data.access_token;
}

export function kcLogout() {
  try { localStorage.removeItem(DEV_FLAG); } catch { /* ignore */ }
  clearTokens();
}
