# Runbook: set up the runner Mac

This Mac runs SonarQube (Docker) **and** the GitHub Actions self-hosted runner.
The `sonar` job connects to SonarQube at `http://localhost:9000` on this machine.

## 1. Prerequisites

- **Docker:**
  - Docker Desktop (or Colima) must be running.
  - Give Docker **6 GB of memory or more** (minimum 4 GB). In Docker Desktop: Settings → Resources → Memory. In Colima: `colima start --memory 6`.
- **Port 9000 must be free.** If another SonarQube is already running, stop it first (`docker ps`, then `docker stop <name>`). `setup.sh` checks this and tells you.
- **Tools:**
  - `git`.
  - Optional: the GitHub CLI (`brew install gh`) to set the secret from the terminal.
- **Keep the Mac awake:** stop it sleeping while you practise (System Settings → Energy / Battery → prevent automatic sleeping). While the Mac sleeps, the `sonar` job sits in the queue.

## 2. Start SonarQube

```bash
git clone https://github.com/shanehowl/sonar-template.git
cd sonar-template
infra/sonarqube/setup.sh
```

Wait until it prints `UP`. The first run takes 1–3 minutes while the images download.

## 3. Secure SonarQube and create the project

1. **Log in.** Open http://localhost:9000 and log in with **admin / admin**. SonarQube makes you choose a new password; store it in your password manager.
2. **Create the project.** Choose **Create Project → Local project** and enter:
   - Display name: `sonar-template`
   - Project key: `sonar-template`
   - Main branch: `main`

   Then click **Next**.
3. **Set the new code definition.** Keep **Previous version** (the default), then click **Create project**.
4. **Skip the setup wizard.** The analysis-method screen offers to walk you through GitHub Actions setup. The repo is already configured, so you only need the token from the next section.

## 4. Create the analysis token

Go to **My Account → Security → Generate Tokens** and enter:

- Name: `github-actions-sonar-template`
- Type: **Project Analysis Token**, Project: `sonar-template`
- Expires in: **30 days**

Copy the token straight away; SonarQube only shows it once. Store it as the repo secret:

```bash
gh secret set SONAR_TOKEN --repo shanehowl/sonar-template   # paste the token when prompted
```

Or use the web UI: repo **Settings → Secrets and variables → Actions → New repository secret**, with the name `SONAR_TOKEN`.

You don't need to set `SONAR_HOST_URL`; it's already a repo **variable** (`http://localhost:9000`).

## 5. Register this Mac as a self-hosted runner

1. In the repo, go to **Settings → Actions → Runners → New self-hosted runner**.
2. Choose **macOS** and this Mac's architecture. Run `uname -m` to check: `arm64` means **ARM64** (Apple Silicon), `x86_64` means **x64** (Intel).
3. Run the **Download** commands shown, in a new folder such as `~/actions-runner`.
4. Run the **Configure** command shown (`./config.sh --url ... --token ...`).
   - The token in that command expires after one hour. If it has expired, reload the page for a fresh one.
   - Accept the default runner group, name and labels (`self-hosted`, `macOS`, `ARM64`/`X64`).
5. Install the runner as a background service, so it survives logouts and reboots:

   ```bash
   ./svc.sh install
   ./svc.sh start
   ```

6. Refresh **Settings → Actions → Runners**. The runner should show **Idle**.

## 6. Hand back

Tell Claude that the runner is Idle and `SONAR_TOKEN` is set. Claude then enables the `sonar` job and runs the end-to-end and failure tests.

## Daily start / stop

```bash
infra/sonarqube/setup.sh                 # start (safe to re-run)
infra/sonarqube/teardown.sh              # stop, keep data
cd ~/actions-runner && ./svc.sh stop     # stop the runner
```
