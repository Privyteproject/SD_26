/**
 * Axios API client with dev-mode auth interceptor.
 *
 * In development, every request automatically receives a Bearer token
 * ("dev-rh-token") so the backend's security bypass accepts it.
 * Once Keycloak is wired up on the frontend, replace the interceptor
 * with the real access token from keycloak-js.
 */
import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// --- DEV AUTH INTERCEPTOR ---
// Attach a hardcoded dev token so the backend recognises us as an RH user.
// TEAM NOTE: Replace this with the real Keycloak token when auth is ready.
apiClient.interceptors.request.use((config) => {
  const token = import.meta.env.VITE_DEV_TOKEN || "dev-rh-token";
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- RESPONSE INTERCEPTOR ---
// Unwrap the `data` field from our StandardResponse envelope.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    console.error("[API Error]", message);
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
