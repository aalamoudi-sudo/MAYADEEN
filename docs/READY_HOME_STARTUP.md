# Prepared home data during authentication

The production Apps Script deployment version 72 (2026-11-21) accepts
`include_home: 'cached'` on auth_login and auth_session. Authentication and
permission checks still finish before returning any home data.

The live script differs from the repository bundle: do not overwrite it with
that bundle. The targeted live changes are:
- Pass `{ cachedOnly: payload.include_home === 'cached' }` into the existing
  buildDashboardHomeData_ call in both authentication response branches.
- After readDashboardHomeCache_, return null on a miss when options.cachedOnly.
- For cachedOnly, missing daily_metrics stays null instead of calling
  readDailyMetrics_ (which would add a Sheets read).

The existing warmer was verified active; it prepares data every ten minutes.
The frontend consumes a successful home payload through its existing validated
sync path; a cache miss falls back to dashboard_home. Manual refresh remains
fresh. No new shared browser cache or authentication bypass was introduced.

Validation: inline script syntax and startup request tests. Production timing
must distinguish warm/cold cache and authenticated first paint; do not equate
successful deployment with a measured latency improvement.
