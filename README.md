# Joineazy – Student, Group & Assignment Management System

A role-based full-stack web app where **students form groups and confirm assignment submissions**, and **professors create assignments and track each group's progress** on one dashboard.

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Recharts |
| Backend | Node.js, Express, `pg`, JWT, bcrypt, zod, helmet |
| Database | PostgreSQL 16 |
| Infra | Docker, docker-compose, nginx |

> **Live demo:** _add platform link here_ · **Demo video:** _add video link here_

---

## 1. Overview of implementation

### Student
- Register / log in (JWT).
- Create a group and add members by **email or student ID**; the owner can add/remove members, members can leave, the owner can delete the group.
- **Join an existing group** two ways: (a) enter the group's **join code** (owner shares it; joins instantly), or (b) **request to join** from the list of groups; the **group owner approves or rejects** under My Group → Join requests.
- View every assignment visible to them (assigned to all, or specifically to their group) and open its **OneDrive link**.
- **Two-step submission confirmation:** "Mark as submitted" → "Yes, I have submitted" → "Confirm submission". The server also requires an explicit `confirmed: true` flag, so the step cannot be bypassed by a stray request.
- **Progress bar** and completion badges for the group; each card shows who confirmed and when.

### Professor (admin)
- Create, edit, view, delete assignments (title, description, due date, OneDrive link).
- Assign to **all students** or **specific groups**.
- Per-assignment **group-wise** and **student-wise** confirmation tables (late submissions flagged).
- **Analytics dashboard**: totals, overall completion rate, stacked bar chart per assignment, pie chart, group performance ranking.

### Key behaviours / rules
- A student belongs to **at most one group** (DB `UNIQUE(user_id)` on `group_members`).
- One confirmation per **(assignment, group)** — any member can confirm for the whole group (DB `UNIQUE(assignment_id, group_id)`); the confirming student is recorded.
- Professor accounts require a **signup code** (`ADMIN_SIGNUP_CODE`), so students can't self-promote.
- Authorization is enforced server-side on every route (role checks + ownership checks); the UI guards are only for UX.

---

## 2. Setup & run

### Option A – Docker (everything)
```bash
docker compose up --build
```
- App: http://localhost:3000 (nginx serves the SPA and proxies `/api` to the backend)
- API: http://localhost:5000/api/health
- Seed demo data (optional):
  ```bash
  docker compose exec backend node src/seed.js
  ```

### Option B – Local development
Prerequisites: Node 20+, PostgreSQL 14+.

```bash
# 1. database
createdb joineazy            # or: psql -U postgres -c "CREATE DATABASE joineazy"

# 2. backend
cd backend
cp .env.example .env         # adjust DATABASE_URL if needed
npm install
npm run seed                 # optional demo data (schema is auto-created on startup)
npm run dev                  # http://localhost:5000

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api -> :5000)
```

### Demo credentials (after seeding) — password `password123`
| Role | Email |
|---|---|
| Professor | professor@joineazy.com |
| Student (Team Alpha owner) | aarav@student.com |
| Student (Team Beta owner) | sana@student.com |
| Student (no group yet) | isha@student.com |

Professor signup code for new accounts: `PROF-2026` (configurable).

### Tests
```bash
cd backend && npm test       # end-to-end API test, needs the Postgres from DATABASE_URL
```

### Environment variables (`backend/.env`)
| Var | Purpose | Default |
|---|---|---|
| `PORT` | API port | 5000 |
| `DATABASE_URL` | Postgres connection string | `postgres://postgres:postgres@localhost:5432/joineazy` |
| `JWT_SECRET` | Token signing secret — **change in production** | `dev-secret` |
| `JWT_EXPIRES_IN` | Token lifetime | 7d |
| `ADMIN_SIGNUP_CODE` | Code required to register as professor | `PROF-2026` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `http://localhost:5173` |

---

## 3. API reference

All routes are prefixed with `/api`. Protected routes need `Authorization: Bearer <token>`. Errors are `{ "error": "message" }`.

### Auth
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | public | `{name, email, password, role?, adminCode?}` → `{token, user}` |
| POST | `/auth/login` | public | `{email, password}` → `{token, user}` |
| GET | `/auth/me` | any | Current user |

### Groups
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/groups` | admin | All groups with members |
| GET | `/groups/me` | student | The student's group (or `null`); owners also get `requests` and `joinCode` |
| POST | `/groups` | student | `{name, members?: [emailOrId]}` – creator becomes owner |
| POST | `/groups/:id/members` | owner | `{identifier}` – add by email or ID |
| POST | `/groups/join` | student (no group) | `{code}` – join instantly with a join code |
| POST | `/groups/:id/join-code` | owner | Regenerate the group's join code |
| GET | `/groups/available` | student | All groups + whether I've requested to join |
| POST / DELETE | `/groups/:id/requests` | student | Request to join / cancel my request |
| POST | `/groups/:id/requests/:userId/approve` | owner | Approve a join request |
| DELETE | `/groups/:id/requests/:userId` | owner | Reject a join request |
| DELETE | `/groups/:id/members/:userId` | owner / self | Remove a member / leave |
| DELETE | `/groups/:id` | owner | Delete group |

### Assignments
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/assignments` | any | Admin: all + completion counts. Student: visible assignments + group status + `progress` |
| GET | `/assignments/:id` | admin | Detail with group-wise and student-wise confirmations |
| POST | `/assignments` | admin | `{title, description, dueDate, onedriveLink, assignToAll, groupIds}` |
| PUT | `/assignments/:id` | admin | Update (same body) |
| DELETE | `/assignments/:id` | admin | Delete |
| POST | `/assignments/:id/confirm` | student | `{confirmed: true}` – confirm for the student's group (409 if already done) |

### Analytics
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/analytics` | admin | `summary`, per-assignment and per-group completion |

Status codes: `400` validation, `401` unauthenticated, `403` wrong role / not owner, `404` missing, `409` conflict (duplicate email/group/confirmation).

---

## 4. Database schema (ER diagram)

```mermaid
erDiagram
    USERS ||--o{ GROUPS : "owns"
    USERS ||--o| GROUP_MEMBERS : "is member (max 1 group)"
    GROUPS ||--|{ GROUP_MEMBERS : "has"
    GROUPS ||--o{ GROUP_REQUESTS : "receives"
    USERS ||--o{ GROUP_REQUESTS : "sends"
    USERS ||--o{ ASSIGNMENTS : "creates (admin)"
    ASSIGNMENTS ||--o{ ASSIGNMENT_GROUPS : "targets (if not assign_to_all)"
    GROUPS ||--o{ ASSIGNMENT_GROUPS : "targeted by"
    ASSIGNMENTS ||--o{ SUBMISSIONS : "receives"
    GROUPS ||--o{ SUBMISSIONS : "confirms"
    USERS ||--o{ SUBMISSIONS : "confirmed_by"

    USERS {
        int id PK
        varchar name
        varchar email UK
        text password_hash
        varchar role "student | admin"
        timestamptz created_at
    }
    GROUPS {
        int id PK
        varchar name UK
        int owner_id FK
        varchar join_code UK
        timestamptz created_at
    }
    GROUP_REQUESTS {
        int group_id PK,FK
        int user_id PK,FK
        timestamptz created_at
    }
    GROUP_MEMBERS {
        int group_id PK,FK
        int user_id PK,FK "UNIQUE"
        timestamptz joined_at
    }
    ASSIGNMENTS {
        int id PK
        varchar title
        text description
        timestamptz due_date
        text onedrive_link
        bool assign_to_all
        int created_by FK
        timestamptz created_at
    }
    ASSIGNMENT_GROUPS {
        int assignment_id PK,FK
        int group_id PK,FK
    }
    SUBMISSIONS {
        int id PK
        int assignment_id FK
        int group_id FK
        int confirmed_by FK
        timestamptz confirmed_at
    }
```

Schema lives in [`backend/src/schema.sql`](backend/src/schema.sql) and is applied idempotently on every API start.

Constraints that carry business rules:
- `group_members.user_id UNIQUE` → one group per student.
- `submissions UNIQUE (assignment_id, group_id)` → one confirmation per group per assignment (also makes concurrent double-clicks safe via `ON CONFLICT DO NOTHING`).
- `ON DELETE CASCADE` everywhere a child is meaningless without its parent.

---

## 5. Architecture

```
┌────────────┐  HTTPS   ┌──────────────────────────┐   /api    ┌──────────────────────────┐    SQL    ┌────────────┐
│  Browser   │ ───────▶ │ nginx (frontend container)│ ───────▶ │ Express API (backend)    │ ────────▶ │ PostgreSQL │
│ React SPA  │ ◀─────── │  static SPA + /api proxy  │          │ routes → middleware → db │           │            │
└────────────┘          └──────────────────────────┘          └──────────────────────────┘           └────────────┘
```

**Request flow:** React page → `api/client.js` (adds JWT) → `/api/...` → `helmet/cors/json` → `authenticate` (verify JWT) → `requireRole` → `validate` (zod) → route handler (parameterised SQL via `pg`) → JSON → `errorHandler` maps errors to status codes.

```
backend/src
├── app.js, index.js, config.js, db.js, schema.sql, seed.js
├── middleware/   auth (JWT + roles) · validate (zod) · errorHandler
├── routes/       auth · groups · assignments · analytics
└── utils/        HttpError · asyncHandler
frontend/src
├── api/          fetch wrapper + endpoint functions
├── context/      AuthContext (session restore, login/logout)
├── components/   Layout, ui primitives (ProgressBar, Badge, Modal…)
└── pages/        Login, Register · student/* · admin/*
```

---

## 6. Key design & deployment decisions

- **Group-level confirmation, student recorded.** The brief says students confirm "once they've uploaded"; since work is submitted per group, one confirmation per group is the source of truth and `confirmed_by` provides student-wise accountability. The student-wise professor view shows each member's group status and who confirmed.
- **Two-step verification on both sides.** UI shows a two-step modal; API rejects requests without `confirmed: true`.
- **JWT in `Authorization` header** (stateless, simple to scale horizontally). Stored in `localStorage` for simplicity; an httpOnly cookie + CSRF protection would be the next hardening step.
- **Professor signup code** instead of open admin registration — a lightweight guard against privilege escalation without building an invitation system.
- **Plain SQL with `pg`** rather than an ORM: the analytics queries (targets ⨝ submissions) are clearer in SQL and easy to explain/optimise. All queries are parameterised.
- **Idempotent migration at startup** keeps setup to one command; for a larger team I'd move to versioned migrations (e.g. node-pg-migrate).
- **Single origin in production**: nginx serves the SPA and proxies `/api`, so no CORS issues and the backend isn't exposed to the browser directly.
- **Docker**: multi-stage frontend build (node → nginx), slim production-only backend image, Postgres healthcheck so the API starts only when the DB is ready (plus connection retry in code).
- **Late submissions** are allowed but flagged to the professor rather than blocked.
- **Lazy-loaded dashboard** keeps the charting library out of the student bundle.

### Known limitations / next steps
- No email invitations (members are added directly by email/ID, as the brief allows).
- No pagination (fine for class-sized data).
- No rate limiting on auth endpoints; add `express-rate-limit` before real deployment.
- **Deployment (Render):** production uses the root `Dockerfile`, a single container where a multi-stage build compiles the React app and Express serves it next to `/api`. Frontend and API share one origin, so no CORS or proxy config is needed. `render.yaml` is a Render Blueprint that provisions this web service plus a managed PostgreSQL database, wires `DATABASE_URL`, and generates `JWT_SECRET`. On boot the container runs `seed.js --if-empty`, so a fresh database gets demo data and restarts never wipe real data. Free-tier instances sleep when idle, so the first request can take ~50s.
- Local multi-container setup (`docker-compose.yml`: nginx SPA + API + Postgres) is unchanged and still the recommended way to run the stack locally.
