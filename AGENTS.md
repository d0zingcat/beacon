# Agent instructions (beacon)

Guidance for humans and coding agents working in this repository.

## Git workflow

**All changes merged into `main` must go through a pull request.** Do not push commits directly to `main`.

1. Create a feature branch from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/your-change
   ```
2. Commit on the branch.
3. Push and open a PR:
   ```bash
   git push -u origin HEAD
   gh pr create
   ```
4. Wait for CI (tests + typecheck) and review before merge.
5. Production deploy runs automatically when the PR is merged to `main` (see `.github/workflows/deploy.yml`).

Direct pushes to `main` bypass review and should only happen in emergencies—and should be avoided when an agent is making changes.
