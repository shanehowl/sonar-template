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
  - **GnuPG** (`brew install gnupg`). Required: `sonarqube-scan-action@v8` verifies the scanner's signature with `gpg`, and fails with "GPG is not available" without it.
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
2. **Connect SonarQube to GitHub.** Go to **Administration → Configuration → General Settings → DevOps Platform Integrations → GitHub → Create configuration**, and choose **Create GitHub App** (the automatic option).
   - GitHub organization: your GitHub account name, e.g. `shanehowl`.
   - Configuration name: `github`.
   - Leave **Also set up GitHub authentication** unticked.

   On GitHub, create the app and install it on **Only select repositories → `sonar-template`**. Back in SonarQube, click **Check configuration**; it should be green.
3. **Import the repo.** Choose **Projects → Create Project → Import from GitHub**, select the account and `sonar-template`, then **Import**. Keep **Previous version** as the new code definition and click **Create project**.
4. **Check the project key.** The analysis-method screen (choose **With GitHub Actions**) shows `sonar.projectKey=...`. It must match `sonar.projectKey` in `sonar-project.properties`; this repo uses `shanehowl_sonar-template_6ecca362-f2b7-422b-b226-51ceb186360b`. If you re-import, update the file to the new key.
   - Skip the rest of the tutorial. The workflow already exists, and `SONAR_HOST_URL` is already a repo variable.
   - **Alternative without GitHub:** **Create Project → Local project**, then set its key in `sonar-project.properties`. The pipeline works the same either way.

## 4. Create the analysis token

Go to **My Account → Security → Generate Tokens** and enter:

- Name: `github-actions-sonar-template`
- Type: **Project Analysis Token**, Project: the imported `sonar-template` project
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

   - **If `./svc.sh status` shows `- 126`,** the service can't start. That happens when the runner folder is in a macOS-protected location (Desktop, Documents, Downloads, iCloud Drive). Either move the runner to `~/actions-runner` and re-register it, or run it in the foreground with `./run.sh` and keep that Terminal window open.
   - **After installing new tools (such as `gpg`),** restart the runner (`./svc.sh stop && ./svc.sh start`, or Ctrl+C then `./run.sh`) so it picks up the updated PATH.

6. Refresh **Settings → Actions → Runners**. The runner should show **Idle**.

## 6. Check it works

Push any commit to `main`, or use **Actions → CI/CD → Run workflow**. All three jobs should go green, with `QUALITY GATE STATUS: PASSED` in the `sonar` job log.

## Daily start / stop

```bash
infra/sonarqube/setup.sh                 # start (safe to re-run)
infra/sonarqube/teardown.sh              # stop, keep data
cd ~/actions-runner && ./svc.sh stop     # stop the runner service (or Ctrl+C if you used ./run.sh)
```
