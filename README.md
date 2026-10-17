# ApartmentSaaS

> Production-grade Multi-Tenant Apartment Management SaaS platform built with React 18 + Vite 5 + TypeScript (frontend) and NestJS 10 + Prisma 5 + MySQL 8 InnoDB (backend).

---

## 📦 Monorepo Structure

```
ApartmentSaaS/
├── apps/
│   ├── web/                     # React 18 + Vite 5 + TypeScript (SPA)
│   │   ├── src/
│   │   │   ├── components/      # ProtectedRoute, UI components
│   │   │   ├── context/         # AuthContext (in-memory token, session lifecycle)
│   │   │   ├── layouts/         # DashboardLayout (tenant switcher, role badges)
│   │   │   ├── lib/             # api.ts (Axios + auto-refresh + CSRF)
│   │   │   └── pages/           # Login, Forgot/Reset Password, Dashboard, Buildings, Users, Audit
│   └── api/                     # NestJS 10 + Prisma 5 + MySQL 8 (REST API)
│       ├── prisma/
│       │   ├── schema.prisma    # Multi-tenant schema with InnoDB constraints
│       │   ├── migrations/      # Version-controlled SQL migrations
│       │   └── seed.ts          # Safe platform admin & demo tenant bootstrap
│       └── src/
│           ├── audit/           # Immutable AuditLog service & controller
│           ├── auth/            # Argon2id, JWT, Guards (Tenant, Permissions, Admin, CSRF)
│           ├── organizations/   # Tenant management & isolation
│           ├── buildings/       # Scoped building facilities management
│           └── users/           # User lifecycle, RBAC & anti-privilege escalation
├── docker/
│   └── mysql/init/              # MySQL init scripts
├── docker-compose.yml           # MySQL 8 + Adminer services
├── .env.example                 # Root environment variables example
├── package.json                 # npm workspaces root
└── README.md
```

---

## 🗄️ Database Schema & Models

The database uses **MySQL 8 with InnoDB engine**. Deletion rules prevent accidental or cascading loss of financial or audit history.

| Model                   | Table Name              | Purpose & Security Controls                                                                                                          |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Organization**        | `organizations`         | SaaS customer tenant entity. Unique slug, status enum (`ACTIVE`, `SUSPENDED`, `PENDING`, `ARCHIVED`).                                |
| **Building**            | `buildings`             | Physical apartment building scoped to an organization. `onDelete: Cascade` with organization.                                        |
| **User**                | `users`                 | User credentials and identity. Unique email, Argon2id `passwordHash`, status enum (`ACTIVE`, `SUSPENDED`, `INVITED`, `DEACTIVATED`). |
| **Role**                | `roles`                 | Role definitions (`PLATFORM_ADMIN`, `OWNER`, `MANAGER`, `ACCOUNTANT`, `STAFF`, `RESIDENT`).                                          |
| **Permission**          | `permissions`           | Granular permission keys (`organizations.*`, `buildings.*`, `users.*`, `subscriptions.*`, `audit_logs.read`).                        |
| **UserRole**            | `user_roles`            | Scoped role assignments to users within organizations or buildings.                                                                  |
| **RolePermission**      | `role_permissions`      | Composite key mapping roles to permissions.                                                                                          |
| **Subscription**        | `subscriptions`         | Multi-tenant billing plan. Protected with `onDelete: Restrict` (financial history is preserved).                                     |
| **SubscriptionInvoice** | `subscription_invoices` | Financial invoice records with Prisma `Decimal` amounts. `onDelete: Restrict`.                                                       |
| **AuditLog**            | `audit_logs`            | Immutable security audit trail with structured JSON metadata. `onDelete: SetNull` for actor and tenant.                              |
| **RefreshToken**        | `refresh_tokens`        | Hashed token sessions with IP/User-Agent tracking, revocation flag, and token rotation reuse detection.                              |
| **PasswordResetToken**  | `password_reset_tokens` | Single-use, short-lived (15-min) tokens stored as SHA-256 hashes.                                                                    |

---

## 🔐 Authentication & Security Architecture

1. **Password Hashing:**
   - Powered by native **Argon2id** (`argon2`), resistant to GPU/ASIC cracking
2. **Session & Refresh Token Management:**
   - **Access Token:** Short-lived JWT (15-minute expiration) kept strictly **in-memory** in frontend state (never `localStorage` or `sessionStorage`).
   - **Refresh Token:** Stored in database as a SHA-256 hash. Transmitted in an **HTTP-only, SameSite=Lax, Secure** cookie (`refresh_token`, 7-day expiration).
   - **Replay / Reuse Detection:** Every refresh rotates the refresh token. If a previously replaced or revoked token is re-submitted, all active sessions for that user are immediately invalidated and an audit alert is triggered.
3. **CSRF Protection:**
   - Employs double-submit CSRF cookie pattern (`XSRF-TOKEN`). Frontend Axios interceptor automatically sends `x-csrf-token` header on mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).
4. **Password Reset Workflow:**
   - `POST /api/v1/auth/forgot-password` always returns a generic, non-disclosing message to prevent email enumeration.
   - Generates single-use 32-byte cryptographically secure token valid for 15 minutes.
   - Successful reset invalidates the reset token and revokes all active refresh tokens across all devices.
5. **Multi-Tenant Isolation:**
   - `TenantGuard` resolves organization membership server-side.
   - Never trusts tenant IDs passed from client requests.
   - Unauthorized cross-tenant access attempts return non-disclosing `404 Not Found` or `403 Forbidden` responses.
6. **Anti-Privilege Escalation:**
   - Organization owners or managers cannot assign the `PLATFORM_ADMIN` role or grant access outside their authorized tenant scope.

---

## 👥 Roles & Permissions Matrix

| Permission Key         | PLATFORM_ADMIN | OWNER | MANAGER | ACCOUNTANT | STAFF |
| ---------------------- | :------------: | :---: | :-----: | :--------: | :---: |
| `organizations.read`   |       ✅       |  ✅   |   ✅    |     ✅     |   —   |
| `organizations.manage` |       ✅       |  ✅   |    —    |     —      |   —   |
| `buildings.read`       |       ✅       |  ✅   |   ✅    |     —      |  ✅   |
| `buildings.manage`     |       ✅       |  ✅   |   ✅    |     —      |   —   |
| `users.read`           |       ✅       |  ✅   |   ✅    |     —      |   —   |
| `users.manage`         |       ✅       |  ✅   |    —    |     —      |   —   |
| `subscriptions.read`   |       ✅       |  ✅   |    —    |     ✅     |   —   |
| `subscriptions.manage` |       ✅       |  ✅   |    —    |     ✅     |   —   |
| `audit_logs.read`      |       ✅       |  ✅   |    —    |     —      |   —   |

---

## ⚙️ Environment Variables

### Root & API (`.env` / `apps/api/.env`)

| Variable                   | Description                                                   | Default / Example                                                         |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`             | MySQL 8 InnoDB connection string                              | `mysql://apartment_user:your_password_here@localhost:3306/apartment_saas` |
| `API_PORT`                 | Backend HTTP listening port                                   | `3001`                                                                    |
| `API_HOST`                 | Backend bind host                                             | `0.0.0.0`                                                                 |
| `NODE_ENV`                 | Application environment (`development`, `production`, `test`) | `development`                                                             |
| `CORS_ORIGINS`             | Allowed frontend origins                                      | `http://localhost:5173`                                                   |
| `JWT_SECRET`               | Primary JWT signing key (min 32 chars)                        | `openssl rand -hex 64`                                                    |
| `JWT_EXPIRES_IN`           | Access token lifetime                                         | `15m`                                                                     |
| `JWT_REFRESH_SECRET`       | Refresh token signing salt                                    | `openssl rand -hex 64`                                                    |
| `JWT_REFRESH_EXPIRES_IN`   | Refresh token lifetime                                        | `7d`                                                                      |
| `COOKIE_SECURE`            | Enforce HTTPS cookies (`true` in production)                  | `false`                                                                   |
| `BOOTSTRAP_ADMIN_EMAIL`    | Initial platform admin account email                          | `admin@apartmentsaas.com`                                                 |
| `BOOTSTRAP_ADMIN_PASSWORD` | Initial platform admin account password                       | `AdminSecure123!`                                                         |
| `BOOTSTRAP_ADMIN_NAME`     | Platform administrator display name                           | `Platform Administrator`                                                  |
| `VITE_API_URL`             | Frontend API baseURL                                          | `http://localhost:3001`                                                   |

---

## 🚀 Exact Windows PowerShell Commands

### 1. Environment Setup

```powershell
# Copy environment configuration files
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
```

### 2. Start MySQL via Docker

```powershell
# Start MySQL 8 container in background
docker compose up -d mysql

# Verify health status
docker compose ps
```

### 3. Database Migrations & Seed

When MySQL is running:

```powershell
# Apply version-controlled migrations
cd apps\api
npx prisma migrate deploy

# Seed roles, permissions, platform admin, and demo tenant
npx prisma db seed
cd ..\..
```

If generating or inspecting migrations:

```powershell
cd apps\api
# Inspect migration status
npx prisma migrate status

# Generate client
npx prisma generate
cd ..\..
```

### 4. Running Tests & Quality Checks

```powershell
# Run backend automated security and auth test suites (25 tests)
npm test

# Run TypeScript typechecks across both frontend and backend
npm run typecheck

# Run ESLint across monorepo
npm run lint

# Build production bundles
npm run build
```

### 5. Starting Development Servers

```powershell
# Start both Frontend (Vite :5173) and Backend (NestJS :3001) concurrently:
npm run dev

# Or start independently in separate PowerShell terminals:
# Terminal 1 — Backend API
npm run dev -w apps/api

# Terminal 2 — Frontend Web
npm run dev -w apps/web
```

---

## 🔑 Development Demo Accounts

When seeded in development mode (`NODE_ENV=development`), the following accounts are pre-configured:

| Role                       | Email                     | Password            | Scope                                         |
| -------------------------- | ------------------------- | ------------------- | --------------------------------------------- |
| **Platform Administrator** | `admin@apartmentsaas.com` | `AdminSecure123!`   | Full SaaS platform access                     |
| **Organization Owner**     | `owner@acme.com`          | `OwnerSecure123!`   | Acme Property Management (`acme-properties`)  |
| **Building Manager**       | `manager@acme.com`        | `ManagerSecure123!` | Sunset Heights Apartments (`demo-building-1`) |

> **Password Rotation Guide:** Users can securely rotate their credentials under `/dashboard/settings`. Rotating credentials immediately revokes all existing refresh sessions server-side.
