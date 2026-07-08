# Scholar360 CRM — Playwright E2E Suite

End-to-end tests for the Scholar360 CRM (React + Vite frontend, Express + Prisma backend).

## Prerequisites

The suite runs against a **already-running** local stack:

| Service  | URL                          |
|----------|------------------------------|
| Frontend | `http://localhost:5173`      |
| Backend  | `http://localhost:5001/api`  |
| Database | seeded (roles + demo leads)  |

Start them first:

```bash
# terminal 1
cd backend && npm run dev
# terminal 2
cd frontend && npm run dev
```

Override targets with `E2E_BASE_URL` / `E2E_API_URL` if your ports differ.

## Running

```bash
npm run test:e2e            # default: non-mutating suite (chromium + mobile)
npm run test:e2e:mobile     # mobile project only (Pixel 7)
npm run test:e2e:report     # open the last HTML report
npx playwright test e2e/tests/auth   # a single folder
```

### Mutating tests (opt-in)

CRUD specs that write to the database are tagged `@mutating` and are **excluded
by default** because this project's dev backend points at a *shared* remote
Postgres. Run them only against a disposable database:

```bash
RUN_MUTATING=1 npx playwright test --grep @mutating
```

They create uniquely-tagged rows and hard-delete them in `afterAll` (via the
backend Prisma client) so no residue is left behind.

## Roles & credentials

Global setup logs every role in once via the API and caches the auth token +
user object under `e2e/.auth/` (git-ignored). Fixtures replay these, seeding the
`token` cookie **and** `sessionStorage` (the SPA restores its session from
`sessionStorage`, which Playwright's `storageState` can't persist).

| Role         | Account                              | Notes                    |
|--------------|--------------------------------------|--------------------------|
| SUPER_ADMIN  | `admin@scholar360.com`               | seeded                   |
| ADMIN        | `arun.manager@scholar360.com`        | seeded                   |
| TEAM_LEADER  | `e2e.teamleader@scholar360.com`      | dedicated E2E account    |
| EMPLOYEE     | `priya.singh@scholar360.com`         | seeded                   |

Password for all: `Demo@1234`.

## Layout

```
e2e/
├── global-setup.js            # API login → cached auth state per role
├── fixtures/
│   ├── roles.js               # role catalogue + credentials
│   └── test.js                # authedTest(role) factory + context auth
├── pages/                     # page objects (LoginPage, AppShell, LeadsPage)
└── tests/
    ├── auth/                  # login (+/-), access-control, session lifecycle
    ├── rbac/                  # role-based nav visibility
    ├── navigation/            # route smoke, 404, broken links, console errors
    ├── dashboard/             # per-role dashboard
    ├── leads/                 # list/search/filter/pagination + CRUD (@mutating)
    └── cross-cutting/         # responsiveness, a11y, network/loading states
```

## Conventions

- Selectors use accessible roles / text / placeholders (the app ships no
  `data-testid`s). Prefer `getByRole`/`getByText` over CSS where possible.
- No fixed `waitForTimeout`s — we wait on URLs, elements, or `networkidle`.
- The `mobile` project only picks up `*.mobile.spec.js`.

See `COVERAGE.md` for what is and isn't covered.
