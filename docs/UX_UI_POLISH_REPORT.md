# UX/UI Polish Report — Mayadeen Project Command Center

Branch: `feature/ux-ui-polish`
Rollback point: parent commit of `91179ec` / normal `git revert` of the UX polish commit; a local workspace backup was also created before editing.

## Project audit summary

- The application is a single-page RTL command center implemented in `index.html`, with Google Apps Script integration isolated in `apps-script/Code.gs`.
- Navigation, layout, routes, cards, tables, forms, sync state, login flow, and page renderers are defined in `index.html`.
- Session enforcement remains based on `sessionToken`, `currentUser`, `allowed_pages`, and `canAccessPage`; no authentication or authorization rules were changed.
- Data loading and synchronization remain routed through the existing Apps Script API helpers; no table names, endpoint payloads, formulas, or data mappers were changed.

## Closed visual issues

| Issue | Page/area | Cause | Implemented change | Test status |
|---|---|---|---|---|
| Active sidebar state could become visual-only | All pages | Active item was toggled independently | Added `syncNavToPage()` and route/page-id based activation | Passed static JS check |
| Sidebar was not collapsible on desktop | App shell | Fixed-width sidebar only | Added saved desktop collapsed mode with icon-only labels and tooltips | Passed static JS check |
| Tablet/mobile navigation consumed layout space | App shell | Sidebar became a horizontal block | Added Drawer overlay, close button, backdrop click, Escape close, and background scroll lock | Passed static JS check |
| Navigation had long flat groups | Sidebar | Labels were visual separators only | Added collapsible logical navigation groups with local persistence | Passed HTML parse |
| No user-controlled display modes | Topbar/pages | Dark mode only | Added Dark, Light, and War Room display mode controls with local persistence | Passed static JS check |
| Tables could overflow without affordance | Table cards | Horizontal overflow existed inconsistently | Added horizontal scroll affordance, sticky headers, row rhythm, and wrapping | Passed CSS/static review |
| Small controls reduced touch usability | Forms/topbar | Control height and font sizes varied | Added centralized field/button height and focus tokens | Passed CSS/static review |
| Keyboard focus was subtle | Interactive controls | Focus states relied on browser defaults | Added visible WCAG-oriented focus ring | Passed CSS/static review |

## Design tokens introduced

Defined in `index.html` inside the `UX/UI Polish tokens and responsive shell` CSS block.

| Token | Value | Usage |
|---|---|---|
| `--surface-0` | `var(--bg)` | Page background |
| `--surface-1` | `var(--panel)` | Panels and sticky table headers |
| `--surface-2` | `var(--card)` | Cards |
| `--surface-raised` | `var(--card2)` | Elevated surfaces |
| `--text-primary` | `var(--text)` | Primary readable text |
| `--text-secondary` | `#a8b4d0` | Secondary text with improved contrast |
| `--border-subtle` | `rgba(255,255,255,.09)` | Subtle borders |
| `--state-success` | `var(--green)` | Complete/ready |
| `--state-warning` | `var(--yellow)` | Needs follow-up |
| `--state-attention` | `var(--orange)` | High/near due |
| `--state-danger` | `var(--red)` | Critical/late |
| `--state-info` | `var(--blue)` | Informational/review |
| `--state-na` | `#7b849c` | Not available/no data |
| `--space-1` … `--space-8` | `4px` … `32px` | Unified spacing scale |
| `--radius-control` | `12px` | Controls/buttons |
| `--field-h` | `44px` | Input/select/textarea minimum height |
| `--button-h` | `42px` | Button minimum height |
| `--icon-size` | `20px` | Navigation icons |
| `--sidebar-collapsed-w` | `84px` | Collapsed desktop sidebar width |
| `--bp-mobile` | `700px` | Mobile breakpoint reference |
| `--bp-tablet` | `1100px` | Tablet/drawer breakpoint reference |
| `--bp-desktop` | `1300px` | Desktop grid breakpoint reference |

## Data-safety confirmation

- No data values were modified.
- No formulas or indicator calculation logic were modified.
- No data sources, Google Sheets bindings, Apps Script payloads, or backend integrations were modified.
- No permissions, login, or session rules were modified.
- No email, notification, approval, escalation, or production deployment action was executed.
- No merge to the main branch was performed.

## Staging note

No Production deployment was performed. A deployable staging artifact is available from this branch after the normal staging deployment process is run by an environment with deployment credentials.

نسخة Staging جاهزة للمراجعة، ولن يتم النشر على Production أو دمج التعديلات في الفرع الرئيسي إلا بعد اعتماد أحمد العامودي.
