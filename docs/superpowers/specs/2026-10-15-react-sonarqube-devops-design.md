# React + GitHub Actions + SonarQube Community Build — DevOps Practice Boilerplate

- **Date:** 2026-10-15
- **Status:** Draft — awaiting owner review
- **Owner:** shanehowl (GitHub account for the practice repo)

## 1. Purpose

A deliberately small React app whose real purpose is to practise a DevOps loop:
push to `main` → GitHub Actions runs lint, tests with coverage and build → a
self-hosted runner scans the code against a self-hosted **SonarQube Community
Build** → the quality gate decides whether the app deploys to **GitHub Pages**.

The app is not the point; the pipeline is. Keep the app trivial.

### Success criteria

1. A push to `main` triggers the workflow automatically.
2. The SonarQube dashboard shows the analysis, including a non-zero coverage figure from Vitest.
3. A failing quality gate fails the workflow and the Pages deploy is skipped.
4. A passing gate deploys the app; both routes load on the Pages URL, including a browser refresh on `/about`.
5. Everything can be torn down cleanly (runner removed, token revoked, containers and volumes deleted).

## 2. Decisions

| Topic | Decision | Reason |
|---|---|---|
| Repo | `shanehowl/sonar-template`, **public**, created by Claude via `gh` in Phase 3 after an explicit go-ahead | Pages is free on public repos |
| App hosting | GitHub Pages via `actions/deploy-pages` (OIDC, no extra secrets) | Simpler than Firebase: no extra account, secret or config files |
| SonarQube hosting | Docker Compose (SonarQube + Postgres) on the owner's **other Mac** | Half-day POC; no cloud cost |
| CI → SonarQube connectivity | GitHub **self-hosted runner** on that same other Mac; `SONAR_HOST_URL=http://localhost:9000` | Nothing exposed to the internet; mirrors the enterprise "runner inside the network" pattern |
| Triggers | `push` to `main` + `workflow_dispatch` only; **no `pull_request`** | Community Build analyses the main branch only; keeps fork code off the self-hosted runner |
| Language | TypeScript | Template default |
| Lint | oxlint (template default); no ESLint | SonarQube supplies the deeper rule set |
| Quality gate | Default "Sonar way"; enforced with `sonar.qualitygate.wait=true` | One step, no extra action |
| Token | SonarQube **project analysis token** with an expiry, stored as repo secret `SONAR_TOKEN`, pasted by the owner | Least privilege; the secret never passes through Claude |
| Commit identity | `shanehowl <18257126+shanehowl@users.noreply.github.com>` (repo-local git config) | Keeps the work identity out of public history |

### Versions (checked 2026-10-15; re-verify at plan time)

- Node 24 LTS in CI (Vitest 5 needs Node ≥22.12; React Router 8 needs ≥22.22)
- vite 8.3.x, create-vite 9.2.x (template `react-ts`), react / react-dom 19.3.x, @vitejs/plugin-react 6.1.x, typescript ~6.0 (template pin)
- react-router 8.4.x (import from `react-router`; `react-router-dom` is gone in v8)
- vitest 5.0.x + @vitest/coverage-v8 (same exact version), jsdom 30.x, @testing-library/react 16.3.x + @testing-library/dom 10.4.x, @testing-library/jest-dom 7.x, @testing-library/user-event 14.6.x
- oxlint ^1.81
- `sonarqube:26.10.0.133078-community` (multi-arch amd64/arm64), `postgres:17`
- `SonarSource/sonarqube-scan-action@v8`, `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` / `download-artifact`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` (latest majors confirmed at plan time)

## 3. Architecture

```
┌──────────── GitHub: shanehowl/sonar-template (public) ────────────┐
│ push to main / manual dispatch ─► .github/workflows/ci-cd.yml      │
│                                                                   │
│  job quality   runs-on: ubuntu-latest (Node 24)                   │
│    npm ci → lint → test:coverage → build (base=/sonar-template/)   │
│    artifacts: coverage/ (actions artifact), dist/ (Pages artifact)│
│        │ needs                                                    │
│  job sonar     runs-on: [self-hosted, macOS]                      │
│    checkout (fetch-depth 0) → download coverage/                  │
│    → sonarqube-scan-action@v8 → http://localhost:9000             │
│      (sonar.qualitygate.wait=true → job fails if gate fails)      │
│        │ needs (gate passed)                                      │
│  job deploy    runs-on: ubuntu-latest, environment github-pages   │
│    deploy-pages → https://shanehowl.github.io/sonar-template/     │
└───────────────────────────────────────────────────────────────────┘
                 ▲ runner long-polls GitHub (outbound HTTPS only)
┌──────────── Other Mac ────────────────────────────────────────────┐
│ Docker Desktop (≥6 GB memory): sonarqube + postgres (127.0.0.1:9000)│
│ actions-runner (native macOS service)                             │
└───────────────────────────────────────────────────────────────────┘
```

Coverage is produced on the GitHub-hosted runner and consumed on the
self-hosted runner. Vitest writes repo-relative `SF:src/...` paths in
`lcov.info`, which resolve correctly after checkout on the other machine.

## 4. Components

### 4.1 React app (`/`)

```
index.html
vite.config.ts           # base from env VITE_BASE (default '/'), Vitest config
package.json             # scripts: dev, build, preview, lint, test, test:coverage
_oxlintrc.json / tsconfig*.json   # from template
scripts/spa-404.mjs      # post-build: copy dist/index.html → dist/404.html
src/
  main.tsx               # BrowserRouter basename = import.meta.env.BASE_URL
  App.tsx                # <Routes>: / → Home, /about → About, * → NotFound
  components/Layout.tsx  # header nav (Home, About) + <Outlet/>
  components/Counter.tsx # increment / decrement / reset; testable logic
  pages/Home.tsx, pages/About.tsx, pages/NotFound.tsx
  setupTests.ts          # jest-dom/vitest matchers
  **/*.test.tsx          # Counter, App routing (MemoryRouter), Layout nav
```

- Target ≥90% line coverage so the default gate (≥80% on new code) passes.
- Vitest config: `environment: 'jsdom'`, `setupFiles`, `coverage.provider 'v8'`, `reporter ['text','lcov']`, output `coverage/lcov.info`, excluding `src/main.tsx` and test files.
- `.gitignore`: `node_modules`, `dist`, `coverage`, `.vitest`, `.scannerwork`, `infra/sonarqube/.env`.

### 4.2 SonarQube stack (`infra/sonarqube/`)

- `docker-compose.yml`:
  - `sonarqube:26.10.0.133078-community`, depends on `db`
  - volumes for `data`, `extensions`, `logs`
  - port `127.0.0.1:9000:9000`
  - JDBC env pointing at `db`
- `db`: `postgres:17`, with its own named volume and a healthcheck.
- `.env.example`: Postgres user, password and database name. The real `.env` is gitignored.
- `setup.sh`, run on the other Mac:
  1. checks Docker is running; fails if Docker memory is below 4 GiB and warns below 6 GiB;
  2. handles `vm.max_map_count` (see §6);
  3. runs `docker compose up -d`;
  4. polls `/api/system/status` until `UP`;
  5. prints the next manual steps.
- `teardown.sh`: `docker compose down` (add `-v` to wipe data).

### 4.3 Sonar configuration (`sonar-project.properties`)

```properties
sonar.projectKey=sonar-template
sonar.projectName=sonar-template
sonar.sources=src
sonar.tests=src
sonar.test.inclusions=src/**/*.test.ts,src/**/*.test.tsx
sonar.exclusions=src/**/*.test.*,**/*.d.ts
sonar.coverage.exclusions=src/main.tsx,src/setupTests.ts,**/*.config.*
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.sourceEncoding=UTF-8
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300
```

### 4.4 Workflow (`.github/workflows/ci-cd.yml`)

- **Top level:**
  - `on: push: branches [main]` and `workflow_dispatch`
  - `permissions: contents: read`
  - `concurrency: { group: pages, cancel-in-progress: false }` (deploy job)
- **`quality`** (ubuntu-latest):
  1. checkout, then setup-node 24 with npm cache
  2. `npm ci`, `npm run lint`, `npm run test:coverage`
  3. build with `VITE_BASE=/${{ github.event.repository.name }}/`
  4. upload `coverage/` as an artifact
  5. run `configure-pages` and upload `dist/` as the Pages artifact
- **`sonar`** (`[self-hosted, macOS]`, needs quality):
  1. checkout with `fetch-depth: 0`
  2. download the `coverage` artifact
  3. run `sonarqube-scan-action@v8` with env `SONAR_TOKEN` (secret) and `SONAR_HOST_URL` (variable)
- **`deploy`** (ubuntu-latest, needs sonar):
  - `permissions: pages: write, id-token: write`
  - `environment: github-pages`
  - runs `deploy-pages`

## 5. Delivery phases and verification

Each phase ends with verification. Claude does not move to the next phase
until its checks pass, and records the evidence.

| # | Phase | Deliverable | Verification |
|---|---|---|---|
| 1 | App | Scaffolded app, 2 pages + 404, tests, Pages base path + SPA 404 | `npm run lint`, `npm run test:coverage` (lcov exists, ≥80%), `npm run build` (dist has `404.html`) all pass; `vite preview` checked with Playwright: both routes, nav, counter |
| 2 | SonarQube (verified on this Mac) | `infra/sonarqube/*`, `sonar-project.properties` | Stack starts; `/api/system/status` returns `UP`; a local scan via the `sonarsource/sonar-scanner-cli` Docker image reports coverage > 0 via `/api/measures/component`; stack stopped and volumes removed afterwards |
| 3 | GitHub repo + CI + Pages (sonar job not yet wired) | Repo `shanehowl/sonar-template` created *after the owner's go-ahead*; Pages source = Actions; `SONAR_HOST_URL` variable set; fork-PR approval setting | `gh run watch` green; Pages URL serves `/` and `/about`, including a direct load of `/about` |
| 4 | Self-hosted runner + gate | Runbook steps the owner performs on the other Mac (setup.sh, admin password, token, runner registration, `gh secret set SONAR_TOKEN`); sonar job enabled; deploy gated on it | Runner shows Idle; full run green with the analysis visible in SonarQube. **Negative test:** a temporary commit that drops coverage → gate fails, deploy skipped → revert → green again |
| 5 | Docs | README: overview, local dev, runbook (other Mac), repo settings, practice exercises, teardown checklist, notes on moving SonarQube to a cloud VM (Caddy + TLS) | A reviewer subagent checks every command and path in the docs against the repo |

### Owner actions (Claude cannot or should not do these)

- Final go-ahead before the public repo is created (Phase 3).
- On the other Mac (Phase 4):
  - run `infra/sonarqube/setup.sh`;
  - log in as `admin/admin` and set a new password;
  - create project `sonar-template` and a project analysis token;
  - run `gh secret set SONAR_TOKEN` (or use the web UI);
  - register the runner (Settings → Actions → Runners → New self-hosted runner) and install it as a service.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Elasticsearch bootstrap check fails on Docker Desktop (`vm.max_map_count`) | Phase 2 tests the actual behaviour. Fix: set the sysctl inside Docker Desktop's VM via a privileged one-shot container. Fallback: `SONAR_SEARCH_JAVAADDITIONALOPTS=-Dnode.store.allow_mmap=false` (local use only). |
| Docker Desktop memory too low → SonarQube OOM | `setup.sh` stops below 4 GiB and warns below 6 GiB, each with a clear message |
| Self-hosted runner on a public repo runs untrusted code | No `pull_request` trigger; fork-PR approval required; runner registered to this repo only; remove it at teardown |
| Coverage paths don't resolve (0% coverage) | Repo-relative lcov paths; explicit `reportPaths`; verified in Phase 2 |
| Sonar job queued forever when the other Mac is offline | Documented: the job waits for a runner; start the runner before pushing, or cancel the run |
| Monthly SonarQube releases | Image pinned to an exact tag; upgrades are deliberate |
| Action major versions move | Pinned majors, re-verified at plan time |

## 7. Out of scope

- PR analysis/decoration and branch analysis (not in Community Build).
- The community branch plugin (unofficial; lags the server version).
- Cloud VM deployment of SonarQube: documented only, not built.
- ESLint, React Compiler, styling frameworks, state libraries, E2E tests in CI.
