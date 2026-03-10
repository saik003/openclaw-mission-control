# CHANGELOG — Mission Control

## 2026-03-10 — Agent Job Queue + Major Platform Improvements

### 🚀 Agent Job Queue System (NEW)

**Purpose:** Automated task dispatch to AI agents with queue management, concurrency control, and operational visibility.

#### Backend
- **`agent_jobs` table** — New model for tracking work assigned to agents. Fields: `agent_id`, `board_id`, `task_id`, `webhook_id`, `payload_id`, `trigger_type`, `title`, `instructions`, `status` (queued/running/done/failed/cancelled), `priority`, `lock_key`, `attempt_count`, `max_attempts`, timestamps.
  - Migration: `k1a2b3c4d5f0_create_agent_jobs`
  - Files: `backend/app/models/agent_jobs.py`, `backend/app/schemas/agent_jobs.py`

- **Workload API** (`GET /api/v1/agent-jobs/workload`) — Returns kanban-style data grouped by agent: running, queued, and failed job lists. Requires org admin.
  - File: `backend/app/api/agent_jobs.py`

- **Worker health API** (`GET /api/v1/agent-jobs/worker-health`) — Returns worker service status (running/stopped), PID, and aggregate queue counts.

- **Worker control APIs** — Start/stop/restart the job worker from the UI:
  - `POST /api/v1/agent-jobs/worker/start`
  - `POST /api/v1/agent-jobs/worker/stop`
  - `POST /api/v1/agent-jobs/worker/restart`

- **Webhook → job creation** — When a webhook payload is ingested, an `agent_job` is automatically created with status `queued`. Deduplication by `payload_id + agent_id`.
  - Modified: `backend/app/api/board_webhooks.py`

- **Agent Job Worker** (`backend/app/services/agent_job_worker.py`) — Background service that polls `agent_jobs` every 5s and dispatches work to agents via gateway sessions. Key behaviors:
  - Max 1 concurrent job per agent (Phase 1)
  - Lock conflict detection (`lock_key`)
  - Stale job timeout: auto-fails after 60 minutes
  - Retry support via `attempt_count` / `max_attempts`
  - Systemd service: `mc-job-worker.service` (enabled, auto-start)

#### Frontend
- **Workload page** (`/workload`) — Kanban view with one column per agent showing running/queued/failed jobs. Auto-refreshes every 10s. Manual refresh button.
  - File: `frontend/src/app/workload/page.tsx`

- **Worker status indicator** (global, in header) — Shows worker status across all pages:
  - Green dot + pulse = running
  - Red dot = stopped
  - Click to expand: PID, queue stats, Start/Stop button
  - File: `frontend/src/components/organisms/WorkerStatusIndicator.tsx`

- **Sidebar link** — "Workload" added to navigation with `Boxes` icon.
  - Modified: `frontend/src/components/organisms/DashboardSidebar.tsx`

---

### 🔗 Board-Agent M2M Relationship

**Purpose:** Allow agents to belong to multiple boards instead of the previous 1:1 relationship.

#### Backend
- **`agent_boards` table** — Many-to-many join table with unique constraint `(agent_id, board_id)`.
  - File: `backend/app/models/agent_boards.py`
- **Batch endpoints:**
  - `POST /api/v1/boards/{board_id}/agents` — Add multiple agents to a board
  - `DELETE /api/v1/boards/{board_id}/agents` — Remove multiple agents from a board
  - No gateway reprovisioning triggered — pure metadata.
  - File: `backend/app/api/boards.py`, `backend/app/services/board_agents.py`
- **Dual-write** — Batch service writes `AgentBoard` rows AND syncs legacy `Agent.board_id` for backward compatibility.

#### Frontend
- **Agent management on board page** — "Add" button opens multi-select dialog (only shows agents not yet on the board). Small `X` button on agent cards for removal (visible on hover). Toast notifications with singular/plural messages.
  - Modified: `frontend/src/app/boards/[boardId]/page.tsx`

---

### 🤖 Agent Model & Hierarchy

**Purpose:** Track which LLM model each agent uses and define reporting relationships.

#### Per-agent model
- **DB column:** `model` on `agents` table (nullable string).
  - Migration: `h1a2b3c4d5e7`
- **Display:** Shown in agents table and detail overview.
- **Edit:** Select dropdown with common models (Claude Opus/Sonnet/Haiku, GPT-4o/mini/5.4, Gemini Pro/Flash).
  - Modified: `backend/app/models/agents.py`, `backend/app/schemas/agents.py`, agent edit/detail pages, `AgentsTable.tsx`

#### Agent hierarchy
- **DB column:** `parent_agent_id` — self-referencing FK on `agents` table, `ON DELETE SET NULL`.
  - Migration: `i1a2b3c4d5e8`
- **Tree visualization:** Hierarchy tab on agents page with collapsible tree.
  - File: `frontend/src/components/agents/AgentsHierarchy.tsx`
- **Edit:** "Reports to" select on agent edit page.
- **Current hierarchy:** Origen (root) → PMO + Asistente → Arquitecto, Frontend Dev, Backend Dev, QA Tester, DevOps, Docs

---

### 📋 Default Task Assignee per Board

**Purpose:** Automatically pre-select an agent when creating tasks, instead of hardcoding by name.

- **DB column:** `default_task_assignee_id` — nullable UUID FK on `boards` table pointing to `agents.id`.
  - Migration: `j1a2b3c4d5e9`
- **Board edit page:** "Default new-task assignee" select dropdown.
- **Task creation dialog:** Reads `board.default_task_assignee_id` to pre-fill the assignee.
  - Modified: `backend/app/models/boards.py`, `backend/app/schemas/boards.py`, board edit page, board detail page

---

### 📝 Agent Files Editor

**Purpose:** Edit agent configuration files (.md) directly from Mission Control UI.

- **API:** Reads/writes `.md` files from `~/.openclaw/agents/mc-{agent_id}/agent/` filesystem. No DB storage.
- **UI:** File tabs + monospace editor on agent edit page.
  - Modified: agent edit page, new API endpoints

---

### 🐛 Bug Fixes

- **Login redirect** — After local auth, redirect to `/dashboard` instead of reloading sign-in page.
  - File: `frontend/src/components/organisms/LocalAuthLogin.tsx`

- **`require_approval_for_done` default** — Changed from `true` to `false` (was resetting on board save).

- **Gateway validation** — Fixed "gateway must have a gateway main agent" by reassigning agent to correct gateway. Deleted orphan duplicate gateway.

- **Agent hierarchy layout** — Removed `flex-wrap` so siblings stay on same horizontal level.

- **Error messages** — `customFetch` now extracts `message` from `detail` objects (not just strings). Prevents generic "Request failed".

- **Toast on board save** — Added "Board settings saved" toast with dedup ref.

---

### 🏗️ Infrastructure

- **Systemd services** (all enabled, auto-start):
  - `mc-backend.service` — FastAPI + Uvicorn (port 8000)
  - `mc-frontend.service` — Next.js dev (port 3001)
  - `mc-job-worker.service` — Agent job queue worker (NEW)
  - `openclaw-gateway.service` — OpenClaw gateway (port 18789)

- **Single gateway:** "Origen Gateway" (`a7ffb5c4`) at `ws://192.168.1.147:18789`

---

### ⚠️ Known Issues / Pending

- **UUID empty-string bug** — Board edit page sends `""` instead of `null` for `board_group_id` and `default_task_assignee_id` when set to "none"/"unassigned". Causes UUID validation error.
- **Goal board validation** — Board "Mission Control" is type `goal` with empty `objective`/`success_metrics`. Blocks board edit via API.
- **Job completion callbacks** — Agents don't yet auto-report job completion. Worker starts jobs but doesn't know when they finish (relies on stale timeout).
- **No retry/backoff** — `attempt_count` is tracked but no exponential backoff yet.

---

### 📊 Migration Chain

```
... → h1a2b3c4d5e7 (agent model)
    → i1a2b3c4d5e8 (parent_agent_id)
    → j1a2b3c4d5e9 (default_task_assignee_id)
    → k1a2b3c4d5f0 (agent_jobs)  ← HEAD
```

### 📁 Key Files Added/Modified

| File | Purpose |
|------|---------|
| `backend/app/models/agent_jobs.py` | AgentJob model |
| `backend/app/schemas/agent_jobs.py` | Pydantic schemas for jobs |
| `backend/app/api/agent_jobs.py` | Workload + worker health/control APIs |
| `backend/app/services/agent_job_worker.py` | Queue worker service |
| `backend/app/models/agent_boards.py` | M2M agent↔board join table |
| `backend/app/services/board_agents.py` | Batch add/remove agents from boards |
| `frontend/src/app/workload/page.tsx` | Workload kanban page |
| `frontend/src/components/organisms/WorkerStatusIndicator.tsx` | Global worker status in header |
| `frontend/src/components/agents/AgentsHierarchy.tsx` | Agent hierarchy tree view |
| `~/.config/systemd/user/mc-job-worker.service` | Systemd unit for worker |
