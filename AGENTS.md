# Agent instructions (beacon)

Guidance for humans and coding agents working in this repository.

## Language

Write **documentation and commit messages in English**.

- **Documentation**: `AGENTS.md`, `README.md`, code comments, PR titles/descriptions, and design docs.
- **Commit messages**: subject line and body in English; use imperative mood (`Add …`, `Fix …`, `Update …`).
- **Source comments**: English unless explaining locale-specific behavior.
- **User-facing copy** in notifications or UI may stay in the language appropriate for the audience (e.g. Chinese Telegram messages).

Examples:

```
# Good
Add squash merge workflow to AGENTS.md

# Bad
为 AGENTS.md 添加 squash merge 工作流
```

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
5. Merge with **squash** only (one commit per PR on `main`):
   ```bash
   gh pr merge --squash
   ```
   The source branch is deleted automatically after merge (`delete_branch_on_merge` is enabled on the repo).
6. Production deploy runs automatically when the PR is merged to `main` (see `.github/workflows/deploy.yml`).

Direct pushes to `main` bypass review and should only happen in emergencies—and should be avoided when an agent is making changes.

### Merge policy

| Setting | Value |
|---------|-------|
| Merge method | Squash only |
| Delete branch after merge | Yes |
| Merge commit / rebase merge | Disabled |
