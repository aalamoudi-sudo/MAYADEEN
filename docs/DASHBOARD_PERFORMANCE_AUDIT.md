# Dashboard performance audit (2026-09-14)

## Measurement boundary

The repository has no production credentials or Sheets fixture, so this audit does **not** invent network or Apps Script durations. The change adds browser and server instrumentation so one authenticated production run reports those values without changing an action name, response field, permission, or Sheet structure.

Browser console events now cover each authenticated API request (`request_start`, response headers, action, status, duration and content length), `data_sync` request/normalization/render marks, Dashboard shell readiness, and the server profile. `sync_meta.performance.datasets` reports every dataset/calculation duration and returned-row count, while `sync_meta` reports spreadsheet-open time, WBS cells read, total sync duration, and serialized response size.

## Observed startup timeline

The code path before and after this patch is:

1. HTML parser downloads/parses the document and the large inline application script.
2. `DOMContentLoaded` binds navigation/filter listeners and calls `bootstrapSession()`.
3. With no saved session, the login UI is immediately usable and no API request starts.
4. With a saved session, `auth_session` runs first; only successful authentication reveals the shell. `data_sync` then starts asynchronously and does not block shell interaction.
5. On a fresh login, `auth_login` runs first, the authenticated Dashboard shell is revealed, then one asynchronous `data_sync` begins.
6. `initData()` normalizes task state and renders only the current page through `renderCurrentPage(true)`. Other pages remain dirty and render on navigation. Inquiries neither bootstrap nor poll unless their page is active.

Thus the remaining measured pre-render frontend blocker was parsing two copies of the same 155,542-character data URI plus the inline application. The images are now one external cacheable PNG, removing both base64 strings from HTML without deleting or visually changing the logo.

## Apps Script bottleneck

A `data_sync` opens one spreadsheet, then performs sequential reads for WBS and the Dashboard response registers. These reads cannot be parallelized in Apps Script. The canonical WBS reader was especially wasteful: `getValues()`, `getDisplayValues()`, and `getNumberFormats()` each transferred the **entire WBS range**, although display text and number format are consumed only for the progress column. It now reads values once for the required full schema and reads display/format data only for that one column.

The critical-path calculation is quadratic in task count because each reverse-pass task scans all nodes and their predecessors. Startup computed it twice: once inside employee workload and once for the `critical_path` response. It is now computed once and reused without changing either output.

## Structural before/after (measured locally)

| Metric | Before | After |
|---|---:|---:|
| `index.html` bytes | 1,082,436 | 772,330 |
| Inline base64 logo copies | 2 | 0 |
| Logo bytes parsed as HTML text | 311,084 characters | 0 |
| Total first-party HTML + logo bytes | 1,082,436 | 888,968 |
| WBS transferred cells | `3 × rows × columns` | `rows × columns + 2 × rows` |
| Critical-path executions per sync | 2 | 1 |
| Initial requests, fresh login | `auth_login`, then `data_sync` | unchanged |
| Initial requests, restored session | `auth_session`, then `data_sync` | unchanged |
| Full current-page renders after sync | 1 | 1 |
| Duplicate initial `data_sync` | 0 | 0 |

Durations, actual row counts, response bytes, and the ten most expensive operations must be copied from the new runtime profile after deployment by an authorized operator. No deployment was performed as part of this work.

## Remaining bottlenecks

`data_sync` still reads all response-contract datasets sequentially. Making secondary and page-only datasets truly lazy requires either a new API action or a contract change, both explicitly excluded from this implementation. The new sorted per-operation timings identify which reads should move first once that API change is approved. The 491 KB inline application script is also still parser work; safely splitting it requires a build/deployment loading strategy rather than deleting features.
