# First Prompt for the AI Coding Agent
Copy and paste the prompt below to initiate your AI Agent session.

---

```markdown
Hello! You are acting as a senior full-stack AI developer. Your goal is to analyze this workspace, identify the remaining work to do on the features, and start troubleshooting and fine-tuning.

### 1. Read key documents to understand the context:
1. `README.md` and `backend/README.md` (architecture, Docker setup, how to run).
2. `SPEC_EVOLUTIONS_IA_RH.md` (the functional specs of features that need work or are in progress).
3. `GUIDE_TEST_MANUEL.md` (the test suite and scenarios, use this to verify your changes).

### 2. Run a full codebase scan to locate the relevant files:
- **Backend Endpoints**: `backend/app/api/v1/endpoints/` (e.g., `ai.py`, `chat.py`, `documents.py`, `search.py`).
- **Database Models & Repository**: `backend/app/db/models.py` and `backend/app/db/repository.py`.
- **Frontend Pages/Features**: `frontend/src/features/` (specifically `assistant/`, `documents/`, and `onboarding/`).
- **API Helpers**: `frontend/src/lib/api.js`.

### 3. Check for specific gaps and inconsistencies:
Look closely for:
- **Double Chat Storage**: We have `ChatSession`/`ChatMessage` vs `ConversationIA`/`InteractionIA` tables. Audit how `/ai/chat` uses them and check if the frontend chat history panel properly shows and deletes conversations.
- **Document Draft & Submission**: Verify that when a document is generated, it is created as a `draft` and that the frontend allows editing the content and explicitly clicking "Soumettre" (submitting) it to change the status to `pending`.
- **Global Search (`/search` endpoint)**: Check if it's already implemented on the backend and if the frontend keyboard shortcut (⌘/Ctrl-K) and search interface are operational.
- **Multilingual Support**: Review language detection on the backend `/ai/chat` endpoint (checking Unicode/heuristics for Arabic and library detection for others) and ensure RTL layout handles Arabic responses in the UI.
- **Assistant Copilot RH**: Verify if `AssistantRh.jsx` correctly passes `audience="rh"` to `Assistant.jsx` and if the backend pipeline redirects to E3/E4 engines when the audience is `rh`.

### 4. Your First Task:
Generate a detailed diagnostic report in the chat. The report must include:
1. **Current Codebase Status**: Which features from `SPEC_EVOLUTIONS_IA_RH.md` are:
   - Already fully implemented (with matching front and back logic).
   - Partially implemented (pointing out the specific files and line numbers where the logic is incomplete or broken).
   - Missing entirely.
2. **First Action Plan**: A step-by-step roadmap to start fine-tuning and troubleshooting the highest-priority gaps, beginning with "Multilingual Support" and "Context Menus" as recommended in the spec.

Do not write any code changes or migrations yet. Start by analyzing the workspace and outputting your diagnostic report and initial plan.
```
