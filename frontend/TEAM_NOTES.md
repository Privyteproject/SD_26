# Team Notes — YDAYS 2026

This document outlines key technical decisions, integration strategies, and developer procedures established during the API integration phase (Week 2).

---

## 🔑 Authentication & Dev Bypass Strategy

To enable seamless frontend development and local API integration testing before full Keycloak Realm provisioning is finalized, a **Dev Token Bypass** is configured in the backend security layer.

### How it Works
When running in development mode (`APP_ENV=dev`), the FastAPI backend recognizes specific static Bearer tokens and automatically provisions a matching mock session:

*   **`dev-rh-token`**: Authenticates as `dev-rh@ydays.local` with the **`rh`** (Human Resources) role.
*   **`dev-admin-token`**: Authenticates as `dev-admin@ydays.local` with the **`admin`** role.

### Frontend Integration
The API client (`frontend/src/app/api/client.js`) automatically appends the token in the headers of every request:
```javascript
config.headers.Authorization = `Bearer ${VITE_DEV_TOKEN || 'dev-rh-token'}`;
```
You can switch roles in the frontend by configuring the `VITE_DEV_TOKEN` environment variable in your local frontend configuration.

> [!WARNING]
> **Production Guardrail:** The dev bypass is strictly disabled if `APP_ENV` is set to anything other than `dev`. Before deploying to staging or production, ensure the bypass block in [security.py](file:///c:/Users/mokht/OneDrive/Desktop/SD_26/backend/app/core/security.py) is commented out or removed entirely.

---

## 📡 API Layer & Vite Networking

### Proxy Configuration
FastAPI automatically redirects requests to resource URLs without trailing slashes. In a Docker Compose environment, this redirect header can leak internal Docker hostnames (`backend:8000`) to the browser, leading to `ERR_NAME_NOT_RESOLVED` errors.

To prevent this, the Vite proxy configuration is set up as follows in [vite.config.js](file:///c:/Users/mokht/OneDrive/Desktop/SD_26/frontend/vite.config.js):
```javascript
proxy: {
  '/api': {
    target: 'http://backend:8000',
    changeOrigin: false, // Must be false to preserve the browser Host header (localhost:5173) on backend redirects
  }
}
```

### Path Standard
All router files in `backend/app/api/v1/endpoints/*.py` have been updated to define paths **without trailing slashes** to prevent unnecessary redirects (e.g., `@router.get("")` instead of `@router.get("/")`). Please maintain this standard for all new endpoints.

---

## 🧪 Running Integration Tests

### Automated Integration Script
A python utility `test_live_apis.py` is included in the project root to quickly query all integrated routes:
```bash
python test_live_apis.py
```
This script tests with the `dev-admin-token` and reports response times and response status codes.

### Running Pytest
To run unit and integration tests inside the running Docker container:
```bash
docker compose exec backend pytest
```
