# React + SonarQube DevOps Practice Boilerplate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A minimal 2-page React app in a public GitHub repo. Each push to `main` runs lint, tests with coverage, build, a SonarQube Community Build scan on a self-hosted macOS runner and a quality gate, then deploys to GitHub Pages.

**Architecture:** Vite 8 + React 19 + React Router 8 app, tested with Vitest 5 (v8 coverage → `coverage/lcov.info`). SonarQube + Postgres run in Docker Compose on the owner's "runner Mac", next to a GitHub self-hosted runner that reaches `http://localhost:9000`. One workflow has three jobs: `quality` (GitHub-hosted) → `sonar` (self-hosted) → `deploy` (GitHub-hosted, Pages).

**Tech Stack:**
- App: Node 24 (CI) / ≥22.22 (local), Vite 8.3, React 19.3, React Router 8.4, TypeScript ~6.0, oxlint 1.x
- Tests: Vitest 5.0, @vitest/coverage-v8, jsdom 30, Testing Library
- Infra: Docker Compose, `sonarqube:26.10.0.133078-community`, `postgres:17`, `sonarsource/sonar-scanner-cli:12.2`
- CI: GitHub Actions (`SonarSource/sonarqube-scan-action@v8`)

**Spec:** `docs/superpowers/specs/2026-10-15-react-sonarqube-devops-design.md`

## Global Constraints

- Repo: `shanehowl/sonar-template`, public. Commit identity (already in repo-local git config): `shanehowl <18257126+shanehowl@users.noreply.github.com>`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never** create the GitHub repo, push, or change GitHub settings without the owner's explicit go-ahead in chat at that moment. Before any `gh` write, confirm that `gh auth status` shows `shanehowl` as the active account.
- **Never** handle the real `SONAR_TOKEN` for the owner's SonarQube. The owner sets it with `gh secret set`. The throwaway SonarQube on *this* Mac (Task 6) may use a generated admin password and token kept in the scratchpad only.
- Workflow triggers are `push` to `main` and `workflow_dispatch` only — **no `pull_request`**.
- Pinned action majors: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`, `SonarSource/sonarqube-scan-action@v8`.
- Imports come from `react-router`, never `react-router-dom`.
- No Vitest coverage thresholds. The SonarQube quality gate is the only coverage gate; a Vitest threshold would fail `quality` before the gate could be exercised.
- SonarQube project key `sonar-template`. `SONAR_HOST_URL=http://localhost:9000` (a repo variable, not a secret).
- Scratchpad for temp files: `/private/tmp/claude-501/-Users-shane-ho-Desktop-github-sonar-template/d2b475d7-2f56-4023-b38d-d30f5dbc05f6/scratchpad` (below: `$SCRATCH`).

## Review Focus

1. **Deep link / refresh on Pages** (`/sonar-template/about` loaded directly) must render About, not GitHub's 404 page. Pinned in Task 4 (`dist/404.html` exists and equals `index.html`; assets use the `/sonar-template/` prefix) and Task 8 (live direct load).
2. **Unknown route** (`/nope`) must show a "Page not found" page with a link home, not a blank screen. Pinned in Task 3.
3. **lcov produced on one machine, scanned on another** must still give coverage > 0, not "Could not resolve N file paths". Pinned in Task 6 (scanner runs in a container where the repo sits at a different absolute path) and Task 10 (scan log checked).
4. **Re-running `setup.sh`** while the stack is already up must leave `.env` unchanged and report UP. Regenerating the DB password would break SonarQube's DB login. Pinned in Task 5.
5. **Runner Mac offline or gate failing** must never deploy. Pinned in Task 10: `deploy` needs `sonar`, plus the negative gate test.

---

## File Structure

```
.gitignore                       # node, build, coverage, scanner, infra .env
package.json / package-lock.json # scripts: dev, build, preview, lint, test, test:watch, test:coverage
index.html, vite.config.ts       # vite.config.ts: base from VITE_BASE + Vitest config
tsconfig.json, tsconfig.app.json, tsconfig.node.json, _oxlintrc.json, public/  # from template
scripts/spa-404.mjs              # post-build: dist/index.html → dist/404.html
src/main.tsx                     # entry: BrowserRouter with basename
src/App.tsx                      # route table
src/index.css                    # minimal styles
src/setupTests.ts                # jest-dom matchers + cleanup
src/components/Counter.tsx (+ .test.tsx)
src/components/Layout.tsx        # nav + Outlet (tested through App.test.tsx)
src/pages/Home.tsx, About.tsx, NotFound.tsx
src/App.test.tsx                 # routing + nav tests
sonar-project.properties
infra/sonarqube/docker-compose.yml, .env.example, setup.sh, teardown.sh, scan-local.sh
.github/workflows/ci-cd.yml
docs/runbook-runner-mac.md       # owner steps on the runner Mac
README.md
```

---

### Task 1: Scaffold the Vite React app with the test toolchain

**Files:**
- Create: everything from the `react-ts` template, `src/setupTests.ts`, `src/smoke.test.ts` (temporary)
- Modify: `vite.config.ts`, `package.json`, `.gitignore`

**Interfaces:**
- Produces: npm scripts `lint`, `test`, `test:coverage`, `build`, `preview`. Vitest globals are off, so tests import `describe/it/expect` from `vitest`. jest-dom matchers are available in every test.

- [ ] **Step 1: Scaffold into the scratchpad, then copy into the repo** (the repo dir is not empty, and `--overwrite` would delete `docs/`)

```bash
cd "$SCRATCH" && rm -rf app && npx -y create-vite@9.2.1 app --template react-ts --no-interactive
rsync -a --exclude .gitignore "$SCRATCH/app/" /Users/shane.ho/Desktop/github/sonar-template/
cat "$SCRATCH/app/.gitignore"   # read it; its entries get merged in Step 3
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/shane.ho/Desktop/github/sonar-template
npm install
npm install react-router@^8.4.0
npm install -D vitest@5.0.4 @vitest/coverage-v8@5.0.4 jsdom@^30.1.2 \
  @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2 \
  @testing-library/jest-dom@^7.0.1 @testing-library/user-event@^14.6.8
```

Expected: no peer-dependency errors.

- [ ] **Step 3: Write `.gitignore`** (template entries merged with ours)

```gitignore
# dependencies & build
node_modules
dist
dist-ssr
*.local

# test & analysis output
coverage
.vitest
.scannerwork

# logs
logs
*.log
npm-debug.log*

# editors / OS
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store

# secrets / local settings
infra/sonarqube/.env
.claude/settings.local.json
```

- [ ] **Step 4: Replace `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// VITE_BASE is set in CI to "/<repo-name>/" for GitHub Pages; local dev serves from "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/setupTests.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
    },
  },
})
```

- [ ] **Step 5: Create `src/setupTests.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 6: Edit `package.json` scripts and engines** (keep the template's `dev`, `preview` and `lint: "oxlint"`)

```json
"engines": { "node": ">=22.22.0" },
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "oxlint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

- [ ] **Step 7: Add a smoke test and run the toolchain**

`src/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs tests with jest-dom matchers', () => {
    document.body.innerHTML = '<p>ok</p>'
    expect(document.querySelector('p')).toBeInTheDocument()
  })
})
```

Run: `npm run lint && npm run test:coverage && npm run build`
Expected: all three exit 0; `coverage/lcov.info` exists; `dist/index.html` exists.
If `tsc -b` reports a missing type for `toBeInTheDocument`, check that `tsconfig.app.json` `include` covers `src` (the template default).

- [ ] **Step 8: Commit**

```bash
git add -A && git status --short   # confirm no node_modules/dist/coverage staged
git commit -m "chore: scaffold Vite 8 React TS app with Vitest coverage toolchain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Counter component (TDD)

**Files:**
- Create: `src/components/Counter.tsx`, `src/components/Counter.test.tsx`
- Delete: `src/smoke.test.ts`

**Interfaces:**
- Produces: `export default function Counter({ initial = 0 }: { initial?: number })`. It renders `role="status"` with text `Count: <n>` and buttons named `Decrement`, `Increment`, `Reset`.

- [ ] **Step 1: Write the failing test** — `src/components/Counter.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Counter from './Counter'

describe('Counter', () => {
  it('starts at zero by default', () => {
    render(<Counter />)
    expect(screen.getByRole('status')).toHaveTextContent('Count: 0')
  })

  it('starts at the given initial value', () => {
    render(<Counter initial={5} />)
    expect(screen.getByRole('status')).toHaveTextContent('Count: 5')
  })

  it('increments and decrements', async () => {
    const user = userEvent.setup()
    render(<Counter />)
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: 1')
  })

  it('goes below zero', async () => {
    const user = userEvent.setup()
    render(<Counter />)
    await user.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: -1')
  })

  it('resets to the initial value', async () => {
    const user = userEvent.setup()
    render(<Counter initial={3} />)
    await user.click(screen.getByRole('button', { name: 'Increment' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('status')).toHaveTextContent('Count: 3')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/Counter.test.tsx`
Expected: FAIL, because `./Counter` cannot be resolved.

- [ ] **Step 3: Implement** — `src/components/Counter.tsx`

```tsx
import { useState } from 'react'

type CounterProps = {
  initial?: number
}

export default function Counter({ initial = 0 }: Readonly<CounterProps>) {
  const [count, setCount] = useState(initial)

  return (
    <section aria-label="Counter" className="counter">
      <p role="status">Count: {count}</p>
      <div className="counter-actions">
        <button type="button" onClick={() => setCount((c) => c - 1)}>
          Decrement
        </button>
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          Increment
        </button>
        <button type="button" onClick={() => setCount(initial)}>
          Reset
        </button>
      </div>
    </section>
  )
}
```

(`Readonly<>` avoids SonarQube rule S6759, which asks for read-only React props.)

- [ ] **Step 4: Run the tests to verify they pass, and remove the smoke test**

```bash
rm src/smoke.test.ts
npx vitest run src/components/Counter.test.tsx   # Expected: 5 passed
npm run lint                                      # Expected: 0 errors
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Counter component with tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pages, layout and routing (TDD)

**Files:**
- Create: `src/components/Layout.tsx`, `src/pages/Home.tsx`, `src/pages/About.tsx`, `src/pages/NotFound.tsx`, `src/App.test.tsx`
- Modify: `src/App.tsx` (replace), `src/main.tsx` (replace), `src/index.css` (replace)
- Delete: `src/App.css`, `src/assets/` (template demo content)

**Interfaces:**
- Consumes: `Counter` from Task 2.
- Produces: `export default function App()` with a route table and no router of its own (tests wrap it in `MemoryRouter`, `main.tsx` in `BrowserRouter`). Headings: Home `Sonar Template`, About `About`, NotFound `Page not found`. Nav landmark is `aria-label="Main"` with links `Home` and `About`.

- [ ] **Step 1: Write the failing tests** — `src/App.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('renders the Home page with the counter at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Sonar Template' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Count: 0')
  })

  it('renders the About page at /about', () => {
    renderAt('/about')
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
  })

  it('renders a not-found page with a link home for unknown paths', () => {
    renderAt('/does-not-exist')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go back home' })).toHaveAttribute('href', '/')
  })

  it('marks the current page in the main navigation', () => {
    renderAt('/about')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('navigates between pages via the nav links', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('link', { name: 'About' }))
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Home' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Sonar Template' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL. The template `App` has no routes or headings.

- [ ] **Step 3: Implement the components**

`src/components/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router'

export default function Layout() {
  return (
    <>
      <header className="site-header">
        <nav aria-label="Main">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
    </>
  )
}
```

`src/pages/Home.tsx`:
```tsx
import Counter from '../components/Counter'

export default function Home() {
  return (
    <>
      <h1>Sonar Template</h1>
      <p>A tiny React app used to practise CI/CD with GitHub Actions and SonarQube.</p>
      <Counter />
    </>
  )
}
```

`src/pages/About.tsx`:
```tsx
export default function About() {
  return (
    <>
      <h1>About</h1>
      <p>
        Every push to <code>main</code> runs lint, tests with coverage and a build on GitHub Actions,
        then a SonarQube Community Build scan on a self-hosted runner. The app deploys to GitHub
        Pages only when the quality gate passes.
      </p>
    </>
  )
}
```

`src/pages/NotFound.tsx`:
```tsx
import { Link } from 'react-router'

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go back home</Link>
      </p>
    </>
  )
}
```

`src/App.tsx`:
```tsx
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import About from './pages/About'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'

// BASE_URL is "/" locally and "/<repo-name>/" on GitHub Pages; the router wants it without the trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

`src/index.css`:
```css
:root {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1f2328;
  background: #ffffff;
}

body {
  margin: 0;
}

.site-header nav {
  display: flex;
  gap: 1rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid #d0d7de;
}

.site-header a {
  color: #0969da;
  text-decoration: none;
}

.site-header a[aria-current='page'] {
  font-weight: 700;
  text-decoration: underline;
}

.site-main {
  max-width: 40rem;
  padding: 1rem 2rem;
}

.counter-actions {
  display: flex;
  gap: 0.5rem;
}
```

```bash
rm -rf src/App.css src/assets
grep -rn "assets/\|App.css" src index.html || true   # Expected: no stale references
```

- [ ] **Step 4: Run all checks**

Run: `npm run lint && npm run test:coverage && npm run build`
Expected: 10 tests pass. The coverage text table shows ≥90% lines overall and 100% for `Counter.tsx`, `Layout.tsx`, `App.tsx` and the pages. Build exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Home/About/NotFound pages with router layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: GitHub Pages build support (base path + SPA 404) and browser check

**Files:**
- Create: `scripts/spa-404.mjs`
- Modify: `package.json` (`build` script)

**Interfaces:**
- Produces: `npm run build` writes `dist/404.html`, identical to `dist/index.html`. With `VITE_BASE=/sonar-template/`, asset URLs are prefixed `/sonar-template/`.

- [ ] **Step 1: Write the check first (expected to fail)**

```bash
VITE_BASE=/sonar-template/ npm run build && test -f dist/404.html && echo PASS || echo FAIL
```

Expected: `FAIL` (no 404.html yet).

- [ ] **Step 2: Create `scripts/spa-404.mjs`**

```js
// GitHub Pages serves 404.html for unknown paths. Copying index.html there lets
// a direct load or refresh of a client-side route (e.g. /about) boot the SPA.
import { copyFileSync, existsSync } from 'node:fs'

const indexPath = 'dist/index.html'

if (!existsSync(indexPath)) {
  console.error(`spa-404: ${indexPath} not found; run vite build first.`)
  process.exit(1)
}

copyFileSync(indexPath, 'dist/404.html')
console.log('spa-404: created dist/404.html')
```

- [ ] **Step 3: Update the build script** in `package.json`

```json
"build": "tsc -b && vite build && node scripts/spa-404.mjs",
```

- [ ] **Step 4: Verify the build output**

```bash
VITE_BASE=/sonar-template/ npm run build
cmp dist/index.html dist/404.html && echo "404 matches index"
grep -o 'src="/sonar-template/assets/[^"]*"' dist/index.html   # Expected: one match
```

- [ ] **Step 5: Browser check with Playwright MCP** (load the tools with ToolSearch `select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_close`)

Run `npm run build && npx vite preview --port 4173 --strictPort` in the background. Then:
1. Navigate to `http://localhost:4173/`. The snapshot shows the heading "Sonar Template" and "Count: 0".
2. Click Increment. The snapshot shows "Count: 1".
3. Click the "About" link. The URL is `/about` and the heading reads "About".
4. Navigate directly to `http://localhost:4173/about`. The heading reads "About" (vite preview has its own SPA fallback; Pages' fallback is verified live in Task 8).
5. Navigate to `http://localhost:4173/nope`. The heading reads "Page not found".
6. Close the browser and stop the preview server.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "build: add GitHub Pages SPA 404 fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: SonarQube Docker Compose stack with setup/teardown scripts

**Files:**
- Create: `infra/sonarqube/docker-compose.yml`, `infra/sonarqube/.env.example`, `infra/sonarqube/setup.sh`, `infra/sonarqube/teardown.sh`

**Interfaces:**
- Produces: Compose project `sonarqube` (network `sonarqube_default`, service `sonarqube` on container port 9000, published to `127.0.0.1:9000`). `setup.sh` is idempotent and exits 0 only when `/api/system/status` reports `UP`. `teardown.sh [--wipe]`.

- [ ] **Step 1: Create `infra/sonarqube/docker-compose.yml`**

```yaml
name: sonarqube

services:
  sonarqube:
    image: sonarqube:26.10.0.133078-community
    depends_on:
      db:
        condition: service_healthy
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/${POSTGRES_DB}
      SONAR_JDBC_USERNAME: ${POSTGRES_USER}
      SONAR_JDBC_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ports:
      # Bound to localhost only: the self-hosted runner on this machine is the only client.
      - "127.0.0.1:9000:9000"
    ulimits:
      nofile:
        soft: 131072
        hard: 131072
      nproc: 8192
    restart: unless-stopped

  db:
    image: postgres:17
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgresql_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 12
    restart: unless-stopped

volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  postgresql_data:
```

- [ ] **Step 2: Create `infra/sonarqube/.env.example`**

```dotenv
# Copied to .env by setup.sh, which replaces the password with a random one.
POSTGRES_USER=sonar
POSTGRES_PASSWORD=replaced-by-setup-sh
POSTGRES_DB=sonarqube
```

- [ ] **Step 3: Create `infra/sonarqube/setup.sh`**

```bash
#!/usr/bin/env bash
# Starts the local SonarQube Community Build stack and waits until it is ready.
# Safe to re-run: an existing .env (database password) is never overwritten.
set -euo pipefail

cd "$(dirname "$0")"

SONAR_URL="http://localhost:9000"
REQUIRED_MAP_COUNT=524288
MIN_MEM_BYTES=$((4 * 1024 * 1024 * 1024))
RECOMMENDED_MEM_BYTES=$((6 * 1024 * 1024 * 1024))
TIMEOUT_SECONDS=300

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v docker >/dev/null || fail "docker not found. Install Docker Desktop first."
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."

mem_bytes=$(docker info --format '{{.MemTotal}}')
mem_mib=$((mem_bytes / 1024 / 1024))
if ((mem_bytes < MIN_MEM_BYTES)); then
  fail "Docker has ${mem_mib} MiB of memory; SonarQube needs at least 4 GiB. Raise it in Docker Desktop > Settings > Resources."
elif ((mem_bytes < RECOMMENDED_MEM_BYTES)); then
  echo "WARNING: Docker has ${mem_mib} MiB of memory; 6 GiB or more is recommended."
fi

# Elasticsearch inside SonarQube needs a high mmap count in the Docker VM's kernel.
map_count=$(docker run --rm alpine:3 sysctl -n vm.max_map_count)
if ((map_count < REQUIRED_MAP_COUNT)); then
  echo "Raising vm.max_map_count in the Docker VM from ${map_count} to ${REQUIRED_MAP_COUNT} (resets when Docker restarts)."
  docker run --rm --privileged alpine:3 sysctl -w "vm.max_map_count=${REQUIRED_MAP_COUNT}" >/dev/null
fi

if [[ ! -f .env ]]; then
  sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env.example >.env
  echo "Created .env with a random database password."
fi

docker compose up -d

printf 'Waiting for SonarQube at %s ' "$SONAR_URL"
deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl -fs "$SONAR_URL/api/system/status" 2>/dev/null | grep -q '"status":"UP"'; do
  ((SECONDS < deadline)) || fail "SonarQube is not UP after ${TIMEOUT_SECONDS}s. Check: docker compose -f infra/sonarqube/docker-compose.yml logs sonarqube"
  printf '.'
  sleep 5
done
echo ' UP'

cat <<EOF

SonarQube is running at ${SONAR_URL}

Next steps (docs/runbook-runner-mac.md):
  1. Log in as admin / admin and set a new password.
  2. Create the local project 'sonar-template' and a project analysis token.
  3. gh secret set SONAR_TOKEN --repo shanehowl/sonar-template
  4. Register this Mac as a self-hosted runner.
EOF
```

- [ ] **Step 4: Create `infra/sonarqube/teardown.sh`**

```bash
#!/usr/bin/env bash
# Stops the SonarQube stack. Pass --wipe to also delete all SonarQube and Postgres data.
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "--wipe" ]]; then
  docker compose down -v
  echo "Stopped SonarQube and deleted all data volumes."
else
  docker compose down
  echo "Stopped SonarQube. Data kept; run with --wipe to delete it."
fi
```

- [ ] **Step 5: Lint the scripts and Compose file**

```bash
chmod +x infra/sonarqube/*.sh
docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable infra/sonarqube/setup.sh infra/sonarqube/teardown.sh
cp infra/sonarqube/.env.example infra/sonarqube/.env && docker compose -f infra/sonarqube/docker-compose.yml config --quiet && rm infra/sonarqube/.env
```

Expected: shellcheck prints nothing; `config --quiet` exits 0.

- [ ] **Step 6: Run the stack on this Mac**

Run: `infra/sonarqube/setup.sh` (takes about 1–3 minutes)
Expected: a WARNING line about memory (this Mac has ~5.8 GiB), then `... UP` and the next-steps text. `curl -s localhost:9000/api/system/status` contains `"status":"UP"`.
If it never comes UP, follow superpowers:systematic-debugging using `docker compose -f infra/sonarqube/docker-compose.yml logs sonarqube | tail -50`. A bootstrap-check failure means adding `SONAR_SEARCH_JAVAADDITIONALOPTS: "-Dnode.store.allow_mmap=false"` (spec §6 fallback).

- [ ] **Step 7: Verify idempotency** (Review Focus #4)

```bash
shasum infra/sonarqube/.env > "$SCRATCH/env.sha"
infra/sonarqube/setup.sh
shasum -c "$SCRATCH/env.sha"     # Expected: OK (password unchanged); setup printed UP again
git status --short infra/        # Expected: .env not listed (gitignored)
```

Leave the stack running for Task 6.

- [ ] **Step 8: Commit**

```bash
git add infra && git commit -m "feat(infra): add SonarQube Community Build + Postgres compose stack

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sonar project config and local scan verification

**Files:**
- Create: `sonar-project.properties`, `infra/sonarqube/scan-local.sh`

**Interfaces:**
- Consumes: the running stack from Task 5 (network `sonarqube_default`) and `coverage/lcov.info` from `npm run test:coverage`.
- Produces: `sonar-project.properties`, read by both the local scanner and `sonarqube-scan-action` in CI. `scan-local.sh` needs `SONAR_TOKEN` in the environment.

- [ ] **Step 1: Create `sonar-project.properties`**

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

# Fail the scan step (and so the pipeline) when the quality gate fails.
sonar.qualitygate.wait=true
sonar.qualitygate.timeout=300
```

- [ ] **Step 2: Create `infra/sonarqube/scan-local.sh`**

```bash
#!/usr/bin/env bash
# Runs a SonarQube analysis of this repo against the local stack using the scanner Docker image.
# Usage: npm run test:coverage && SONAR_TOKEN=<project analysis token> infra/sonarqube/scan-local.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

: "${SONAR_TOKEN:?Set SONAR_TOKEN to a project analysis token}"
[[ -f "${repo_root}/coverage/lcov.info" ]] || {
  echo "ERROR: coverage/lcov.info is missing. Run: npm run test:coverage" >&2
  exit 1
}

# The repo is mounted at /usr/src, a different absolute path from the host,
# which also proves lcov paths are repo-relative.
docker run --rm \
  --network sonarqube_default \
  -e SONAR_HOST_URL=http://sonarqube:9000 \
  -e SONAR_TOKEN \
  -v "${repo_root}:/usr/src" \
  sonarsource/sonar-scanner-cli:12.2
```

`chmod +x infra/sonarqube/scan-local.sh`, then run shellcheck as in Task 5 Step 5. Expected: no output.

- [ ] **Step 3: Prepare the throwaway local instance** (this Mac only; the password and token stay in `$SCRATCH`)

```bash
ADMIN_PW="$(openssl rand -hex 12)Aa1!" && echo "$ADMIN_PW" > "$SCRATCH/local-admin-pw"
curl -fsu admin:admin -X POST "localhost:9000/api/users/change_password" \
  --data-urlencode login=admin --data-urlencode previousPassword=admin --data-urlencode "password=$ADMIN_PW"
curl -fsu "admin:$ADMIN_PW" -X POST "localhost:9000/api/projects/create" \
  -d project=sonar-template -d name=sonar-template -d mainBranch=main
curl -fsu "admin:$ADMIN_PW" -X POST "localhost:9000/api/user_tokens/generate" \
  -d name=local-verify -d type=PROJECT_ANALYSIS_TOKEN -d projectKey=sonar-template \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])' > "$SCRATCH/local-token"
```

Expected: each call exits 0, and `$SCRATCH/local-token` is non-empty.

- [ ] **Step 4: Scan and check the results**

```bash
npm run test:coverage
SONAR_TOKEN="$(cat "$SCRATCH/local-token")" infra/sonarqube/scan-local.sh 2>&1 | tee "$SCRATCH/scan.log" | tail -20
grep -c "Could not resolve" "$SCRATCH/scan.log"   # Expected: 0
grep "QUALITY GATE STATUS" "$SCRATCH/scan.log"     # Expected: PASSED
curl -fsu "admin:$(cat "$SCRATCH/local-admin-pw")" \
  "localhost:9000/api/measures/component?component=sonar-template&metricKeys=coverage,ncloc,bugs,vulnerabilities,code_smells"
```

Expected: the scanner exits 0 and the `coverage` measure is > 0 (about 90+). If coverage is 0 or missing, check the `SF:` lines in `coverage/lcov.info` (they must be `src/...`), then debug with superpowers:systematic-debugging.
Also look at `api/issues/search?componentKeys=sonar-template`. If the app's own code has issues, fix them now so the CI baseline is clean.

- [ ] **Step 5: Tear down the throwaway instance**

```bash
infra/sonarqube/teardown.sh --wipe
rm -f infra/sonarqube/.env "$SCRATCH/local-token" "$SCRATCH/local-admin-pw"
docker volume ls | grep sonarqube || echo "volumes gone"
```

- [ ] **Step 6: Commit**

```bash
git add sonar-project.properties infra/sonarqube/scan-local.sh
git commit -m "feat(sonar): add project config and local scan script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: CI/CD workflow — quality + Pages deploy (sonar job comes in Task 10)

**Files:**
- Create: `.github/workflows/ci-cd.yml`

**Interfaces:**
- Consumes: npm scripts from Tasks 1–4.
- Produces: job ids `quality` and `deploy`, and the artifact named `coverage` (contents of `coverage/`). Task 10 adds `sonar` between them.

- [ ] **Step 1: Create `.github/workflows/ci-cd.yml`**

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  workflow_dispatch:

# No pull_request trigger: SonarQube Community Build analyses main only, and the
# self-hosted runner must never execute code from forks.

permissions:
  contents: read

jobs:
  quality:
    name: Lint, test, build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage

      - run: npm run build
        env:
          VITE_BASE: /${{ github.event.repository.name }}/

      - name: Upload coverage for the SonarQube job
        uses: actions/upload-artifact@v7
        with:
          name: coverage
          path: coverage/
          retention-days: 7

      - uses: actions/configure-pages@v6

      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist/

  deploy:
    name: Deploy to GitHub Pages
    needs: quality
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    concurrency:
      group: pages
      cancel-in-progress: false
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 2: Lint the workflow**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add .github && git commit -m "ci: add lint/test/build and GitHub Pages deploy workflow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Create the GitHub repo, configure it, push, and verify Pages — ⚠️ OWNER GO-AHEAD REQUIRED

**Files:** none (GitHub-side configuration)

**Interfaces:**
- Produces: `https://github.com/shanehowl/sonar-template`, Pages at `https://shanehowl.github.io/sonar-template/`, and repo variable `SONAR_HOST_URL=http://localhost:9000`.

- [ ] **Step 1: Stop and ask the owner** for an explicit go-ahead to create the public repo `shanehowl/sonar-template`. Do not continue without it.

- [ ] **Step 2: Confirm the account**

Run: `gh auth status`
Expected: `shanehowl` is `Active account: true`. If not, ask the owner to run `! gh auth switch -u shanehowl`.

- [ ] **Step 3: Create and configure the repo** (Pages is enabled before the first push so the first deploy succeeds)

```bash
R=shanehowl/sonar-template
gh repo create "$R" --public --description "React + Vite boilerplate for practising GitHub Actions with SonarQube Community Build"
gh api -X POST "repos/$R/pages" -f build_type=workflow
gh api -X PUT "repos/$R/actions/permissions/workflow" -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false
gh api -X PUT "repos/$R/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors
gh variable set SONAR_HOST_URL --repo "$R" --body "http://localhost:9000"
```

Expected: every command exits 0. `gh api repos/$R/pages --jq .build_type` prints `workflow`.

- [ ] **Step 4: Push**

```bash
gh auth setup-git
git remote add origin https://github.com/shanehowl/sonar-template.git
git push -u origin main
git log -1 --format='%an <%ae>'   # Expected: shanehowl <18257126+shanehowl@users.noreply.github.com>
```

- [ ] **Step 5: Watch the run**

```bash
sleep 5; RUN=$(gh run list --repo shanehowl/sonar-template --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --repo shanehowl/sonar-template --exit-status
```

Expected: `quality` and `deploy` both succeed. On failure: `gh run view "$RUN" --log-failed`, then superpowers:systematic-debugging.

- [ ] **Step 6: Verify the live site** (Review Focus #1)

```bash
curl -fsS https://shanehowl.github.io/sonar-template/ | grep -c '<div id="root">'   # Expected: 1
curl -sS -o /dev/null -w '%{http_code}\n' https://shanehowl.github.io/sonar-template/about   # Expected: 404 (fallback page)
curl -sS https://shanehowl.github.io/sonar-template/about | grep -c '<div id="root">'   # Expected: 1 (our 404.html = SPA)
```

Then use Playwright: navigate directly to `https://shanehowl.github.io/sonar-template/about`, and the snapshot shows heading "About". Click "Home" and the heading reads "Sonar Template". Navigate to `.../sonar-template/nope` and the heading reads "Page not found". Close the browser.

---

### Task 9: Runner-Mac runbook

**Files:**
- Create: `docs/runbook-runner-mac.md`

**Interfaces:**
- Consumes: `infra/sonarqube/setup.sh`, the project key `sonar-template`, repo `shanehowl/sonar-template`.
- Produces: the owner's step-by-step guide for Task 10's prerequisites.

- [ ] **Step 1: Write `docs/runbook-runner-mac.md`**

````markdown
# Runbook: set up the runner Mac

This Mac runs SonarQube (Docker) **and** the GitHub Actions self-hosted runner.
The `sonar` job connects to SonarQube at `http://localhost:9000` on this machine.

## 1. Prerequisites

- macOS with Docker Desktop running. Set Settings → Resources → Memory to **6 GB or more** (minimum 4 GB).
- `git`. Optionally the GitHub CLI (`brew install gh`) to set the secret from the terminal.
- Stop the Mac from sleeping while you practise (System Settings → Energy / Battery → prevent automatic sleeping). A sleeping Mac leaves the `sonar` job queued.

## 2. Start SonarQube

```bash
git clone https://github.com/shanehowl/sonar-template.git
cd sonar-template
infra/sonarqube/setup.sh
```

Wait until it prints `UP` (1–3 minutes on the first run, while images download).

## 3. Secure SonarQube and create the project

1. Open http://localhost:9000 and log in with **admin / admin**. You are forced to choose a new password; store it in your password manager.
2. **Create Project → Local project**. Display name `sonar-template`, project key `sonar-template`, main branch `main`. Next.
3. New code definition: **Previous version** (the default). Create project.
4. Analysis method: **With GitHub Actions** is fine as a read-through, but the repo is already configured. You only need the token.

## 4. Create the analysis token

**My Account → Security → Generate Tokens**:

- Name: `github-actions-sonar-template`
- Type: **Project Analysis Token**, Project: `sonar-template`
- Expires in: **30 days**

Copy the token (it is shown only once) and store it as the repo secret:

```bash
gh secret set SONAR_TOKEN --repo shanehowl/sonar-template   # paste the token when prompted
```

Or use the web UI: repo **Settings → Secrets and variables → Actions → New repository secret**, name `SONAR_TOKEN`.

`SONAR_HOST_URL` is already set as a repo **variable** (`http://localhost:9000`).

## 5. Register this Mac as a self-hosted runner

1. In the repo: **Settings → Actions → Runners → New self-hosted runner**.
2. Choose **macOS** and the architecture of this Mac (**ARM64** for Apple Silicon, **x64** for Intel; check with `uname -m`: `arm64` or `x86_64`).
3. Run the **Download** commands shown, in a new folder such as `~/actions-runner`.
4. Run the **Configure** command shown (`./config.sh --url ... --token ...`). The token in it expires after one hour; reload the page for a fresh one. Accept the default runner group, name and labels (`self-hosted`, `macOS`, `ARM64`/`X64`).
5. Install it as a background service so it survives logouts and reboots:

```bash
./svc.sh install
./svc.sh start
```

6. Refresh **Settings → Actions → Runners**. The runner shows **Idle**.

## 6. Hand back

Tell Claude that the runner is Idle and `SONAR_TOKEN` is set. Claude then enables the `sonar` job and runs the end-to-end and failure tests.

## Daily start / stop

```bash
infra/sonarqube/setup.sh                 # start (safe to re-run)
infra/sonarqube/teardown.sh              # stop, keep data
cd ~/actions-runner && ./svc.sh stop     # stop the runner
```
````

- [ ] **Step 2: Verify that every command and path in it exists**

```bash
for f in infra/sonarqube/setup.sh infra/sonarqube/teardown.sh; do test -x "$f" && echo "ok $f"; done
grep -n "sonar.projectKey=sonar-template" sonar-project.properties
```

- [ ] **Step 3: Commit and push** (the owner needs it on GitHub to clone; pushing to the existing repo is covered by the Task 8 go-ahead)

```bash
git add docs/runbook-runner-mac.md && git commit -m "docs: add runner Mac runbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

Expected: the CI run is green again (quality + deploy).

- [ ] **Step 4: Hand off to the owner.** Point them to `docs/runbook-runner-mac.md` and wait for confirmation that the runner is **Idle** and `SONAR_TOKEN` is set. Check it yourself:

```bash
gh api repos/shanehowl/sonar-template/actions/runners --jq '.runners[] | "\(.name) \(.status) \([.labels[].name] | join(","))"'   # Expected: <name> online self-hosted,macOS,...
gh secret list --repo shanehowl/sonar-template   # Expected: SONAR_TOKEN listed
```

---

### Task 10: Enable the SonarQube job, gate the deploy, run positive and negative tests

**Files:**
- Modify: `.github/workflows/ci-cd.yml`
- Create then revert: `src/utils/grade.ts` (negative test only)

**Interfaces:**
- Consumes: artifact `coverage` from `quality`, `secrets.SONAR_TOKEN`, `vars.SONAR_HOST_URL`, `sonar-project.properties`.
- Produces: job `sonar`; `deploy` now `needs: [quality, sonar]`.

- [ ] **Step 1: Add the `sonar` job** between `quality` and `deploy` in `.github/workflows/ci-cd.yml`

```yaml
  sonar:
    name: SonarQube scan + quality gate
    needs: quality
    runs-on: [self-hosted, macOS]
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # full history for blame / new-code detection

      - name: Download coverage from the quality job
        uses: actions/download-artifact@v8
        with:
          name: coverage
          path: coverage/

      - name: SonarQube scan (fails if the quality gate fails)
        uses: SonarSource/sonarqube-scan-action@v8
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
```

and change `deploy`:

```yaml
  deploy:
    name: Deploy to GitHub Pages
    needs: [quality, sonar]
```

- [ ] **Step 2: Lint**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color`
Expected: no output. (A label warning about `macOS` on self-hosted runners is fine.)

- [ ] **Step 3: Commit, push and watch** (positive test; this first analysis is the baseline)

```bash
git add .github && git commit -m "ci: add SonarQube scan on self-hosted runner and gate deploy on it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
sleep 5; RUN=$(gh run list --repo shanehowl/sonar-template --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --repo shanehowl/sonar-template --exit-status
gh run view "$RUN" --repo shanehowl/sonar-template --log | grep -E "QUALITY GATE STATUS|Could not resolve|Sensor JavaScript/TypeScript Coverage"
```

Expected: all three jobs succeed. The log shows `QUALITY GATE STATUS: PASSED`, no `Could not resolve` lines, and the coverage sensor ran. Ask the owner to confirm the dashboard at `http://localhost:9000/dashboard?id=sonar-template` shows coverage > 0.

- [ ] **Step 4: Negative test: introduce untested code with an issue**

`src/utils/grade.ts` (≥20 uncovered new lines so the coverage condition applies; the `TODO` adds a new issue):
```ts
// TODO: remove — deliberate quality-gate failure for the pipeline exercise
export function grade(score: number): string {
  if (score < 0 || score > 100) {
    throw new RangeError(`score out of range: ${score}`)
  }
  if (score >= 90) {
    return 'A'
  }
  if (score >= 80) {
    return 'B'
  }
  if (score >= 70) {
    return 'C'
  }
  if (score >= 60) {
    return 'D'
  }
  if (score >= 50) {
    return 'E'
  }
  return 'F'
}

export function describeGrade(score: number): string {
  const letter = grade(score)
  switch (letter) {
    case 'A':
      return 'Excellent'
    case 'B':
      return 'Good'
    case 'C':
      return 'Fair'
    case 'D':
      return 'Poor'
    default:
      return 'Failing'
  }
}
```

```bash
git add src/utils/grade.ts && git commit -m "test(ci): deliberately fail the quality gate (will be reverted)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
sleep 5; RUN=$(gh run list --repo shanehowl/sonar-template --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --repo shanehowl/sonar-template --exit-status; echo "exit=$?"
gh run view "$RUN" --repo shanehowl/sonar-template --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
```

Expected: `exit=1`. `Lint, test, build: success`, `SonarQube scan + quality gate: failure` (log shows `QUALITY GATE STATUS: FAILED`), `Deploy to GitHub Pages: skipped`.

- [ ] **Step 5: Revert and confirm recovery**

```bash
git revert --no-edit HEAD && git commit --amend -m "Revert deliberate quality-gate failure

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
sleep 5; RUN=$(gh run list --repo shanehowl/sonar-template --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --repo shanehowl/sonar-template --exit-status
```

Expected: all three jobs succeed again, with `QUALITY GATE STATUS: PASSED`.

---

### Task 11: README, practice exercises, teardown, cloud-VM notes, and doc review

**Files:**
- Create: `README.md` (replaces the template README if one was copied)

- [ ] **Step 1: Write `README.md`**

````markdown
# sonar-template

A deliberately tiny React app for practising a DevOps pipeline:
**GitHub Actions → SonarQube Community Build (self-hosted) → quality gate → GitHub Pages**.

Live app: https://shanehowl.github.io/sonar-template/

## How the pipeline works

```
push to main ──► quality  (GitHub-hosted)   oxlint → vitest + coverage → build
                    │ coverage artifact
                    ▼
                 sonar    (self-hosted Mac) sonarqube-scan-action → http://localhost:9000
                    │ quality gate PASSED   (sonar.qualitygate.wait=true)
                    ▼
                 deploy   (GitHub-hosted)   GitHub Pages
```

- Triggers: push to `main` and manual **Run workflow**. No pull-request trigger: Community Build analyses one branch, and a public repo's self-hosted runner must not run fork code.
- If the runner Mac is off, the `sonar` job waits in the queue and nothing deploys.

## Stack

Vite 8 · React 19 · React Router 8 · TypeScript · oxlint · Vitest 5 + Testing Library (v8 coverage → `coverage/lcov.info`) · SonarQube Community Build 26.10 + Postgres 17 (Docker Compose).

## Local development

Requires Node ≥ 22.22 (CI uses Node 24).

```bash
npm install
npm run dev            # http://localhost:5173
npm run lint
npm test               # or: npm run test:watch
npm run test:coverage  # writes coverage/lcov.info
npm run build          # dist/ (+ 404.html SPA fallback for GitHub Pages)
```

## Repository settings (already applied)

| Setting | Value |
|---|---|
| Settings → Pages → Source | GitHub Actions |
| Settings → Actions → General → Workflow permissions | Read repository contents |
| Settings → Actions → General → Fork PR approval | Require approval for all external contributors |
| Variable `SONAR_HOST_URL` | `http://localhost:9000` |
| Secret `SONAR_TOKEN` | SonarQube project analysis token (set by the owner) |

## Runner Mac setup

See [docs/runbook-runner-mac.md](docs/runbook-runner-mac.md).

## Scanning without CI

With the stack running and a token:

```bash
npm run test:coverage
SONAR_TOKEN=<token> infra/sonarqube/scan-local.sh
```

## Practice exercises

1. **Break the gate on coverage:** add an untested file of 20+ lines → push → the `sonar` job fails and `deploy` is skipped. Revert.
2. **Break the gate on an issue:** add `// TODO` or an unused variable → watch the "new issues" condition fail.
3. **Custom quality gate:** in SonarQube, copy "Sonar way", raise coverage on new code to 90%, assign it to the project, push again.
4. **Rotate the token:** generate a new project analysis token, `gh secret set SONAR_TOKEN`, re-run, then revoke the old one.
5. **Runner offline:** stop the runner (`./svc.sh stop`), push, observe the queued job, start it again.
6. **Status output:** replace `sonar.qualitygate.wait` with `SonarSource/sonarqube-quality-gate-action@v1` and use its `quality-gate-status` output in a later step.

## Teardown checklist

1. Repo **Settings → Actions → Runners** → remove the runner. On the runner Mac: `cd ~/actions-runner && ./svc.sh stop && ./svc.sh uninstall && ./config.sh remove --token <token from the remove dialog>`.
2. SonarQube **My Account → Security** → revoke the token; `gh secret delete SONAR_TOKEN --repo shanehowl/sonar-template`.
3. `infra/sonarqube/teardown.sh --wipe` (deletes containers and all data).
4. Optional: unpublish Pages (Settings → Pages) or archive/delete the repo.
5. On the machine you used with `gh`: `gh auth switch` back to your usual account.

## Moving SonarQube to a cloud VM later

1. Create a Linux VM (Ubuntu 24.04, ≥ 4 GB RAM, ideally 8 GB, 30 GB disk) that allows inbound 80/443 only.
2. Install Docker, then `sudo sysctl -w vm.max_map_count=524288` (persist it in `/etc/sysctl.d/99-sonarqube.conf`).
3. Copy `infra/sonarqube/` and add a Caddy service to the Compose file:

   ```yaml
   caddy:
     image: caddy:2
     ports: ["80:80", "443:443"]
     command: caddy reverse-proxy --from sonar.<your-ip>.sslip.io --to sonarqube:9000
     volumes: [caddy_data:/data]
   ```

   (Remove the `127.0.0.1:9000` port mapping, and add `caddy_data:` under `volumes:`.)
4. Set the repo variable `SONAR_HOST_URL=https://sonar.<your-ip>.sslip.io` and change the `sonar` job's `runs-on` to `ubuntu-latest`. No self-hosted runner is needed.
5. Delete the VM when finished.
````

- [ ] **Step 2: Doc review by a subagent**

Dispatch a `general-purpose` subagent with this prompt: "In /Users/shane.ho/Desktop/github/sonar-template, check README.md and docs/runbook-runner-mac.md against the repo. For every command, npm script, file path, workflow job name, setting and version mentioned, confirm it exists and matches (package.json, .github/workflows/ci-cd.yml, infra/sonarqube/*, sonar-project.properties). Report mismatches only, with file:line." Fix every reported mismatch.

- [ ] **Step 3: Commit, push, verify**

```bash
git add README.md && git commit -m "docs: add README with pipeline overview, exercises and teardown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
sleep 5; RUN=$(gh run list --repo shanehowl/sonar-template --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" --repo shanehowl/sonar-template --exit-status
```

Expected: green (this needs the runner Mac online).

- [ ] **Step 4: Final whole-branch review** with superpowers:requesting-code-review against the spec. Then report to the owner: what was built, the evidence for each success criterion (spec §1), and anything left for them.
