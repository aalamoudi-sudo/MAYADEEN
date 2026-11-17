# Login performance — 2026-11-17

The browser now requests `auth_login` with `include_home: false`. Authentication completes before the existing authenticated-shell and `loadExternal` flow fetches home data. This removes home-data generation from the login splash's critical path; it does not claim to eliminate the time needed to fetch project data.

The backend reuses a fresh request-local User Access Matrix snapshot for password verification and writes evidence permission cells only when they differ from policy. Login still bypasses the user cache. The audit write remains mandatory and synchronous. Successful responses include authentication, session, audit and total timings, logged by the browser without credentials.

Tests cover unchanged/changed permissions, single-read behavior, password changes, disabled accounts, unauthorized evidence access, session contracts, and syntax.

## Deployment

Deployed the targeted backend edits to the existing Apps Script web app as version 71 on 2026-11-17. The live source includes independent changes absent from repository sources (including optional home prefetch). Applied exact guarded replacements to those authentication functions rather than overwriting the live source with the repository bundle. Preserved the deployment URL, execution identity, access settings, and unrelated live logic. The live profile additionally measures optional home generation.

No authenticated before/after latency measurement was performed; operation-count improvements are verified in tests. Version 70 remains available for backend rollback. Future full bundle deployments must reconcile the pre-existing source drift first.
