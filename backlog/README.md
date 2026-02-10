# Backlog Grooming (GitHub Issue Sync)

This repo currently has a scaffolded Cortex v2 codebase plus a handful of MVP epics (#1-#6). The goal of `backlog/` is to provide a reproducible, reviewable "source of truth" for:

- labels
- milestones
- detailed, atomic backlog issues (including upgrading the existing epics)

## Files

- `backlog/plan.mjs`: milestone/label/issue definitions
- `backlog/sync.mjs`: sync script that upserts labels/milestones/issues into GitHub via `gh`

## Prereqs

You must be authenticated with GitHub CLI (`gh`) for write access.

One of:

```bash
gh auth login -h github.com
```

Or:

```bash
export GH_TOKEN=...   # needs repo/public_repo scope
```

## Run

From repo root:

```bash
node backlog/sync.mjs
```

## Notes

- Issues are idempotent via a `Backlog-Id: cortex-XXXX` marker in the body.
- For existing epics (#1-#6), sync will update their titles/bodies and labels to match `backlog/plan.mjs`.

