# Branch protection (required checks)

CI (`.github/workflows/ci.yml`) runs **typecheck + lint + test + build** on every PR and on
push to `main`. To make a red PR block merge (Plan §2.6 / T0.1.5), enable branch protection
on `main`:

- Settings → Branches → Add rule for `main`
- ✅ Require status checks to pass before merging
- Required check: **`verify`** (the CI job)
- ✅ Require branches to be up to date before merging

This is a repo setting (applied in GitHub), not committed code. With it on: a PR that fails
typecheck/lint/test shows a red required check and cannot be merged; a clean PR is mergeable.
