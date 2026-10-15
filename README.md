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

- **Triggers:** push to `main`, or the manual **Run workflow** button. There is no pull-request trigger, for two reasons:
  - Community Build only analyses one branch.
  - On a public repo, the self-hosted runner must never run code from forks.
- **Fork pull requests:** dropping the `pull_request` trigger is not enough, because a fork can add its own workflow file. What protects the runner Mac is the repo setting that requires approval for outside contributors. **Never approve workflow runs on fork PRs**: approving runs their code on your Mac.
- **If the runner Mac is off,** the `sonar` job waits in the queue and nothing deploys.

## Stack

| Area | Tools |
|---|---|
| App | Vite 8, React 19, React Router 8, TypeScript |
| Lint and tests | oxlint; Vitest 5 + Testing Library, with v8 coverage written to `coverage/lcov.info` |
| Code quality | SonarQube Community Build 26.10 + Postgres 17, run with Docker Compose |

## Local development

Requires Node 22.22 or later (CI uses Node 24).

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
| Secret `SONAR_TOKEN` | SonarQube project analysis token. Set by the owner during runner setup; see [runbook §4](docs/runbook-runner-mac.md#4-create-the-analysis-token) |

## Runner Mac setup

See [docs/runbook-runner-mac.md](docs/runbook-runner-mac.md).

## Scanning without CI

With the SonarQube stack running and a token, you can scan from your own machine:

```bash
npm run test:coverage
SONAR_TOKEN=<token> infra/sonarqube/scan-local.sh
```

## Practice exercises

1. **Break the gate on coverage.** Add an untested file of 20+ lines and push. The `sonar` job fails and `deploy` is skipped. Then revert.
2. **Break the gate on an issue.** Add a `// TODO` comment or a nested ternary (e.g. `const size = a ? 'S' : b ? 'M' : 'L'`) and watch the "new issues" condition fail. (Don't use an unused variable: TypeScript's `noUnusedLocals` fails the build in the `quality` job before SonarQube ever runs.)
3. **Custom quality gate.** In SonarQube, copy "Sonar way", raise coverage on new code to 90%, assign the new gate to the project, then push again.
4. **Rotate the token.** Generate a new project analysis token, run `gh secret set SONAR_TOKEN`, re-run the workflow, then revoke the old token.
5. **Runner offline.** Stop the runner (press Ctrl+C in the `./run.sh` window, or `cd ~/actions-runner && ./svc.sh stop` if you installed the service), push, watch the job sit in the queue, then start it again (`./run.sh` or `./svc.sh start`).
6. **Status output.** Replace `sonar.qualitygate.wait` with `SonarSource/sonarqube-quality-gate-action@v1`, and use its `quality-gate-status` output in a later step.

## Troubleshooting

| Symptom in the `sonar` job | Cause | Fix |
|---|---|---|
| `GPG is not available` | The scan action verifies the scanner's signature with `gpg` | `brew install gnupg` on the runner Mac, then restart the runner |
| `429 (Too Many Requests)` while downloading actions | GitHub rate-limited the runner's network | Wait a minute, then **Re-run failed jobs** |
| Job stuck in "Queued" | The runner is offline | Start it (`./run.sh` or `./svc.sh start`) |
| `QUALITY GATE STATUS: FAILED` | The gate did its job | Open the dashboard link in the log and fix the new code |

## Known limitations

- **No branch or pull-request analysis.** SonarQube Community Build analyses the main branch only. Branch and PR analysis need Developer Edition or SonarQube Cloud.
- **Deep links return HTTP 404.** On GitHub Pages, loading a link like `/sonar-template/about` directly gets an HTTP **404** status while still rendering the page (served by the `404.html` SPA fallback). Browsers show a console error. Search engines may not index those URLs, which doesn't matter for this practice app.

## Teardown checklist

1. **Remove the runner.**
   - In the repo, go to **Settings → Actions → Runners** and remove it.
   - On the runner Mac, in `~/actions-runner`:
     - If you used `./run.sh`: press Ctrl+C in its window.
     - If you installed the service: run `./svc.sh stop` and then `./svc.sh uninstall`.
     - Either way, then run `./config.sh remove --token <token from the remove dialog>`.
2. **Revoke the token.**
   - In SonarQube, go to **My Account → Security** and revoke it.
   - Run `gh secret delete SONAR_TOKEN --repo shanehowl/sonar-template`.
3. **Delete SonarQube.** Run `infra/sonarqube/teardown.sh --wipe`, which deletes the containers and all data.
4. **Remove the SonarQube GitHub App.** On GitHub, go to **Settings → Applications → Installed GitHub Apps**, then **Configure → Uninstall**. Then go to **Settings → Developer settings → GitHub Apps → the app → Advanced → Delete GitHub App**.
5. **Optional:** unpublish Pages (Settings → Pages), or archive or delete the repo.
6. **Switch accounts back.** On the machine where you used `gh`, run `gh auth switch` to return to your usual account.

## Moving SonarQube to a cloud VM later

1. **Create a VM.**
   - Ubuntu 24.04, at least 4 GB RAM (ideally 8 GB), 30 GB disk.
   - Allow inbound traffic on ports 80 and 443, plus port 22 (SSH) restricted to your own IP so you can copy files and administer the VM.
2. **Prepare the VM.** Install Docker, then run `sudo sysctl -w vm.max_map_count=524288`. To keep that setting after a reboot, put it in `/etc/sysctl.d/99-sonarqube.conf`.
3. **Add HTTPS with Caddy.** Copy `infra/sonarqube/` to the VM and add a Caddy service to the Compose file:

   ```yaml
   caddy:
     image: caddy:2
     ports: ["80:80", "443:443"]
     command: caddy reverse-proxy --from sonar.<your-ip>.sslip.io --to sonarqube:9000
     volumes: [caddy_data:/data]
   ```

   Also remove the `127.0.0.1:9000` port mapping and add `caddy_data:` under `volumes:`.
4. **Point CI at the VM.**
   - Set the repo variable `SONAR_HOST_URL=https://sonar.<your-ip>.sslip.io`.
   - Change the `sonar` job's `runs-on` to `ubuntu-latest`.
   - You no longer need a self-hosted runner.
5. **Delete the VM** when you're finished.
