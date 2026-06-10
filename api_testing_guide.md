# 🚀 Quick Frontend API Verification Guide

Use this guide to verify that all frontend pages are successfully fetching and rendering live data from the FastAPI database instead of falling back to mock placeholders.

---

## 🔑 Setup: Choose Your Role

Modify `VITE_DEV_TOKEN` or edit [client.js](file:///c:/Users/mokht/OneDrive/Desktop/SD_26/frontend/src/app/api/client.js) to set your role bypass token, then refresh the browser (`Ctrl + Shift + R`).

| Role | Token | Verification Route |
| :--- | :--- | :--- |
| **HR (RH)** | `dev-rh-token` | Full Access (except Admin-only system logs) |
| **Admin** | `dev-admin-token` | Absolute Access (required for Security & AI Supervision) |

---

## 🛠️ Testing Scenarios

Navigate to the routes below. If the API is connected, **the red fallback warning banner will NOT appear**, and you will see the exact live data below:

### 📈 Dashboard & Analytics (Role: HR or Admin)
*   **Go to:** `/dashboard-rh` (or click Home)
    *   **Verify Donut Chart:** Headcount by department displays **IT: 64, Ventes: 52, RH: 18, Finance: 31, Ops: 83**.
    *   **Verify Monthly Absence Trend:** Line chart graphs rates from **Jan: 3.4%** to **Juin: 2.7%**.
    *   **Verify Turnover Trend:** Displays historic curve (real) and dotted AI forecast (**Juin: 7.9%**, **Juil: 7.6%**, etc.).
    *   **Verify Payroll Trend:** Displays monthly totals (Jan: 1.82M MAD to Juin: 1.97M MAD).
    *   **Verify Weekly absences:** Displays weekly absences counts (Lun: 1, Mar: 2, etc.).

### 👥 Collaborators & Absences (Role: HR or Admin)
*   **Go to:** `/employees`
    *   **Verify Table:** Lists collaborators directly from the Postgres database.
*   **Go to:** `/absences` (or `/requests`)
    *   **Verify Table:** Lists leave requests and statuses (Pending, Approved, Rejected) from the database.

### 📁 Documents & Ingestion (Role: HR or Admin)
*   **Go to:** `/documents`
    *   **Verify Table:** Shows uploaded document list with storage paths matching MinIO keys.
*   **Go to:** `/imports`
    *   **Action:** Drag and upload any `.xlsx` or `.csv` file.
    *   **Verify Output:** Success toast pops up, and new rows are appended to the main employees database.

### 🧠 Workflows & Predictives (Role: HR or Admin)
*   **Go to:** `/onboarding`
    *   **Verify Checklist:** Week-by-week onboarding tasks render (**Week 1: Sign contract**, etc.).
    *   **Verify Contacts Card:** Renders key contacts (**Manager: Sofia Alami, HR: Karim Benali**).
*   **Go to:** `/onboarding-rh`
    *   **Verify Progress:** Displays collective new hires' onboarding tracking (e.g. **Lina Cherkaoui: 70%**).
*   **Go to:** `/offboarding`
    *   **Verify Checklist:** Departure checklist compliance items display (**Equipment return: Done**, etc.).
*   **Go to:** `/disengagement`
    *   **Verify Cards:** Risk profile cards display predictive disengagement levels (High/Med/Low).

### 🛡️ Auditing & Security (Role: Admin)
*   **Go to:** `/audit`
    *   **Verify Table:** Displays chronological list of admin actions, IP addresses, and change diffs.
*   **Go to:** `/alerts`
    *   **Verify Output:** Shows active security events. Click **Acknowledge**; the alert should fade out.
*   **Go to:** `/supervision`
    *   **Verify AI Stats:** Displays daily token usage metrics.
    *   **Verify AI Logs:** Table lists detailed prompt logs, model signatures, and AI safety verdicts.
