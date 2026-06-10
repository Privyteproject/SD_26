/**
 * API service functions for all backend endpoints.
 *
 * Each function returns the Axios promise. Components call these
 * via useState/useEffect to fetch data from the FastAPI backend.
 */
import apiClient from "./client";

// ────────────────────────────────────────────────────────────────
// Employees
// ────────────────────────────────────────────────────────────────

export async function getEmployees(params = {}) {
  const res = await apiClient.get("/employees", { params });
  return res.data; // StandardResponse { success, message, data, meta }
}

export async function getEmployee(id) {
  const res = await apiClient.get(`/employees/${id}`);
  return res.data;
}

export async function createEmployee(payload) {
  const res = await apiClient.post("/employees", payload);
  return res.data;
}

export async function updateEmployee(id, payload) {
  const res = await apiClient.patch(`/employees/${id}`, payload);
  return res.data;
}

export async function deleteEmployee(id) {
  const res = await apiClient.delete(`/employees/${id}`);
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Departments
// ────────────────────────────────────────────────────────────────

export async function getDepartments(params = {}) {
  const res = await apiClient.get("/departments", { params });
  return res.data;
}

export async function createDepartment(payload) {
  const res = await apiClient.post("/departments", payload);
  return res.data;
}

export async function updateDepartment(id, payload) {
  const res = await apiClient.patch(`/departments/${id}`, payload);
  return res.data;
}

export async function deleteDepartment(id) {
  const res = await apiClient.delete(`/departments/${id}`);
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Absences
// ────────────────────────────────────────────────────────────────

export async function getAbsences(params = {}) {
  const res = await apiClient.get("/absences", { params });
  return res.data;
}

export async function getAbsence(id) {
  const res = await apiClient.get(`/absences/${id}`);
  return res.data;
}

export async function createAbsence(payload) {
  const res = await apiClient.post("/absences", payload);
  return res.data;
}

export async function updateAbsence(id, payload) {
  const res = await apiClient.patch(`/absences/${id}`, payload);
  return res.data;
}

export async function deleteAbsence(id) {
  const res = await apiClient.delete(`/absences/${id}`);
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Documents
// ────────────────────────────────────────────────────────────────

export async function getDocuments(params = {}) {
  const res = await apiClient.get("/documents", { params });
  return res.data;
}

export async function getDocument(id) {
  const res = await apiClient.get(`/documents/${id}`);
  return res.data;
}

export async function createDocument(payload) {
  const res = await apiClient.post("/documents", payload);
  return res.data;
}

export async function deleteDocument(id) {
  const res = await apiClient.delete(`/documents/${id}`);
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const res = await apiClient.get("/users/me");
  return res.data;
}

export async function getUsers() {
  const res = await apiClient.get("/users/");
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Notifications
// ────────────────────────────────────────────────────────────────

export async function getNotifications() {
  const res = await apiClient.get("/notifications/");
  return res.data;
}

export async function markNotificationRead(id) {
  const res = await apiClient.patch(`/notifications/${id}/read`);
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Imports
// ────────────────────────────────────────────────────────────────

export async function importEmployeesFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post("/imports/employees", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Analytics & Dashboard (New)
// ────────────────────────────────────────────────────────────────

export async function getHeadcount(params = {}) {
  const res = await apiClient.get("/analytics/headcount", { params });
  return res.data;
}

export async function getAbsenceTrend(params = {}) {
  const res = await apiClient.get("/analytics/absences", { params });
  return res.data;
}

export async function getTurnoverTrend(params = {}) {
  const res = await apiClient.get("/analytics/turnover", { params });
  return res.data;
}

export async function getPayrollTrend(params = {}) {
  const res = await apiClient.get("/analytics/payroll", { params });
  return res.data;
}

export async function getTeamAbsences(params = {}) {
  const res = await apiClient.get("/analytics/team-absences", { params });
  return res.data;
}

export async function getEngagementTrend(params = {}) {
  const res = await apiClient.get("/analytics/engagement", { params });
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Admin & Supervision (New)
// ────────────────────────────────────────────────────────────────

export async function getAuditLogs(params = {}) {
  const res = await apiClient.get("/audit-logs", { params });
  return res.data;
}

export async function getSecurityAlerts(params = {}) {
  const res = await apiClient.get("/alerts", { params });
  return res.data;
}

export async function acknowledgeAlert(id) {
  const res = await apiClient.patch(`/alerts/${id}/acknowledge`);
  return res.data;
}

export async function getDisengagementRisks(params = {}) {
  const res = await apiClient.get("/disengagement/risks", { params });
  return res.data;
}

export async function getAiUsage(params = {}) {
  const res = await apiClient.get("/supervision/usage", { params });
  return res.data;
}

export async function getAiEvents(params = {}) {
  const res = await apiClient.get("/supervision/events", { params });
  return res.data;
}

export async function getAiLogs(params = {}) {
  const res = await apiClient.get("/supervision/logs", { params });
  return res.data;
}

// ────────────────────────────────────────────────────────────────
// Workflows (New)
// ────────────────────────────────────────────────────────────────

export async function getOnboardingTasks(params = {}) {
  const res = await apiClient.get("/onboarding/tasks", { params });
  return res.data;
}

export async function getOnboardingContacts(params = {}) {
  const res = await apiClient.get("/onboarding/contacts", { params });
  return res.data;
}

export async function getNewHires(params = {}) {
  const res = await apiClient.get("/onboarding/new-hires", { params });
  return res.data;
}

export async function getDepartures(params = {}) {
  const res = await apiClient.get("/offboarding/departures", { params });
  return res.data;
}

export async function getOffboardingSteps(params = {}) {
  const res = await apiClient.get("/offboarding/steps", { params });
  return res.data;
}

export async function getReports(params = {}) {
  const res = await apiClient.get("/offboarding/reports", { params });
  return res.data;
}
