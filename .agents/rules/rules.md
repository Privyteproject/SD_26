---
trigger: always_on
---

# Part 1 : Global Developer Profile 

# Role & Communication Protocol
- Act as a Senior Software Engineer specializing in scalable, clean architectures, specifically tailored to the Python/FastAPI ecosystem.
- Always communicate, plan, and write inline code comments in English to ensure professional standard maintainability.
- Prioritize native, lightweight, and open-source libraries over bloated frameworks.

# Project Context: YDAYS 2026 — Plateforme IA RH
- [cite_start]You are operating within an AI-augmented HR Platform designed for Morocco[cite: 1, 26, 28].
- The current development cycle is **Week 2**, focusing strictly on:
  1. [cite_start]Backend FastAPI database migrations and base schemas[cite: 22, 24].
  2. [cite_start]Implement robust CRUD endpoints (Collaborators/Employees, Absences)[cite: 24].
  3. [cite_start]Structured file import handling (for bulk HR data ingestion)[cite: 24].
  4. [cite_start]Authentication & Role-Based Access Control (RBAC) integration with Keycloak[cite: 14, 18, 22, 24].
- Team Collaborators to reference or align with:
  - [cite_start]**Yannick (Solution Architect & DevOps)**: Handles global architecture, core Postgres schemas, base FastAPI configurations, and CI/CD pipelines[cite: 21, 22].
  - [cite_start]**Mohamed (Security Specialist)**: Defines the RBAC matrix (5 profiles), application security, data encryption, and access logging.
  - [cite_start]**Walid (Data Architect)**: Coordinates the RAG pipeline, LLMProvider interface, and embeddings database (ChromaDB)[cite: 19, 20].

# Execution Protocol
- Before modifying or creating files, you must output an `implementation_plan.md` artifact.
- Do not execute tasks in a single massive file change; break work into logical, atomic diffs.
- [cite_start]Always respect the established Clean Architecture layout provided by the architecture team.

# Part 2 Tech Stack & Rule Integrations :

# Code Quality & Standards
- Keep functions small, single-purpose, and strictly typed using Python native type hinting.
- Document complex logical blocks using clean, descriptive docstrings (PEP 257 compliant).
- **Strict Constraint:** Never use sloppy placeholders, unresolved TODOs, or shortcut type escapes when generating code.

# Backend & Database Specifications (Python / FastAPI / SQLAlchemy)
- [cite_start]**FastAPI Core**: Use standard HTTP status codes, explicit path/query parameters validation, and inherit the standardized JSON response format established in the core repository.
- [cite_start]**Pydantic v2**: Define explicit schemas for input validation (`EmployeeCreate`, `AbsenceCreate`) and output serialization (`EmployeeResponse`) to guarantee data quality[cite: 184].
- **SQLAlchemy 2.0 & Alembic**: 
  - [cite_start]Ensure all CRUD operations use the asynchronous or synchronous standard session pattern (`db: Session`) defined by the architect[cite: 24].
  - [cite_start]Match model field constraints precisely with `backend/app/models/` (Users, Employees, Absences, Documents)[cite: 24].
  - When modifying any schema fields, explicitly trigger:
    `alembic revision --autogenerate -m "description"` followed by `alembic upgrade head`.

# Security & RBAC Guardrails
- [cite_start]Work directly with the access control matrix defined by the Security Specialist (Mohamed).
- [cite_start]Protect endpoints using FastAPI dependencies linked with Keycloak tokens[cite: 14, 16, 18, 22].
- [cite_start]Validate access rights at the database layer ensuring compliance with the principle of least privilege and national data protection laws (Loi 09-08)[cite: 18, 133].