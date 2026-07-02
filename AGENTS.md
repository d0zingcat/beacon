# Agent instructions (beacon)

Guidance for humans and coding agents working in this repository.

> **中文** | 面向在本仓库工作的人类与编码代理的说明。

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

> **中文 · 语言**
>
> **文档与 commit message 请使用英文。**
>
> - **文档**：`AGENTS.md`、`README.md`、代码注释、PR 标题/描述、设计文档。
> - **Commit message**：主题与正文使用英文；祈使语气（如 `Add …`、`Fix …`、`Update …`）。
> - **源码注释**：默认英文；仅在说明 locale 相关行为时可用其他语言。
> - **面向用户的文案**（通知、UI）可按受众语言（如 Telegram 中文消息）。
>
> 示例：
>
> ```
> # Good（推荐）
> Add squash merge workflow to AGENTS.md
>
> # Bad（不推荐 — 中文 commit 主题，应改用英文）
> 为 AGENTS.md 添加 squash merge 工作流
> ```

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

> **中文 · Git 工作流**
>
> **所有合入 `main` 的变更必须通过 Pull Request**，不要直接 push 到 `main`。
>
> 1. 从 `main` 创建功能分支（见上方命令）。
> 2. 在分支上提交。
> 3. Push 并创建 PR。
> 4. 等待 CI（测试 + 类型检查）与 review 后再合并。
> 5. **仅使用 squash 合并**（`gh pr merge --squash`；`main` 上每个 PR 对应一个 commit）。
>    合并后源分支自动删除（仓库已启用 `delete_branch_on_merge`）。
> 6. PR 合入 `main` 后自动触发生产部署（见 `.github/workflows/deploy.yml`）。
>
> 紧急情况下才允许直接 push `main`；代理进行变更时应避免。
>
> **合并策略**
>
> | 设置 | 值 |
> |------|-----|
> | 合并方式 | 仅 Squash |
> | 合并后删除分支 | 是 |
> | Merge commit / Rebase merge | 已禁用 |
