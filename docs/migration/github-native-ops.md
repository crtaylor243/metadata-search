# GitHub-Native Repository Operations

This runbook captures the migration from GitLab-native automation to GitHub-native repository operations.

## 1) CI workflows

Workflow: `.github/workflows/ci.yml`

Coverage:
- Lint (`npm run lint`)
- Typecheck (`npm run typecheck`)
- Build (`npm run build`)
- Unit tests (`npm run test:unit`)
- Integration tests (`npm run test:integration`)

Implementation details:
- Node matrix currently pinned to `20.x` (easy to expand later).
- npm dependency caching is enabled with `actions/setup-node@v4` cache.

## 2) Security workflows

Implemented workflows:
- CodeQL: `.github/workflows/codeql.yml`
- Dependency review: `.github/workflows/dependency-review.yml`
- Secret scanning in CI (Gitleaks): `.github/workflows/secret-scan.yml`

Policy notes:
- Dependency review fails PRs on `moderate` and above vulnerabilities and blocks strong-copyleft licenses.
- Secret scanning runs on push and PR with repository history available (`fetch-depth: 0`).
- `.gitleaks.toml` extends default Gitleaks signatures and adds a Discogs token-specific rule.

## 3) Branch protections

GitHub does not support branch protection configuration from repository files only.
Use script:

```bash
node scripts/github-ops/branch-protection.mjs \
  --owner <org-or-user> \
  --repo metadata-search \
  --branch main \
  --required-check "CI / lint-type-build-test (20.x)" \
  --required-check "CodeQL" \
  --required-check "Dependency Review" \
  --required-check "Secret Scan"
```

Defaults enforced by script:
- Required pull request reviews (1 approval, stale dismissal, last-push approval)
- Required status checks (strict)
- Required conversation resolution
- Linear history enabled
- Force pushes and deletions disabled
- Admins are included in enforcement

Use `--dry-run` first to preview payload.

## 4) Vercel integration (manual checklist)

1. In Vercel, **Import Project** from the GitHub repository.
2. Confirm Git branch mapping:
   - Production Branch: `main`
   - Preview Branches: all non-production branches (default Vercel behavior)
3. Verify environment variables are present in all required environments:
   - `DATABASE_URL`
   - `DISCOGS_TOKEN`
4. Trigger one test PR to verify preview deployment creation.
5. Merge to `main` to verify production deployment.

## 5) Migration validation checklist

- [ ] PR checks are green (`CI`, `CodeQL`, `Dependency Review`, `Secret Scan`).
- [ ] Preview deployments are created for every PR.
- [ ] Merge to `main` triggers production deployment.
- [ ] Rollback documented and tested:
  - [ ] Promote previous successful deployment in Vercel UI, or
  - [ ] Revert commit in GitHub and allow auto-deploy.
