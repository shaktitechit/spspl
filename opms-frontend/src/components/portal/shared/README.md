# Portal shared components

Cross-portal UI used by admin, sales, finance, account, dispatch, and super-admin routes.

## Layout

| Folder | Purpose |
|--------|---------|
| `shell/` | Auth gate, overview shell, busy/mutation overlays, loaders |
| `ui/` | Reusable modal chrome, badges, fulfillment widgets |
| `hooks/` | Shared React hooks |
| `lib/` | Pure helpers (users, fleet labels, pickers, etc.) |
| `parties/` | Party/zone list & detail pages, modals, Google Sheet import |
| `products/` | Catalog pages, kit mapping, product modals |
| `fleet/` | Drivers, vehicles, transport agents (+ modals) |
| `orders/list/` | Order list, workflow tabs, unbilled, routing |
| `orders/detail/` | Order detail page, tabs, dispatch modals |
| `orders/components/` | Order tabs/widgets shared across portals |
| `orders/modals/` | Order-level modals not tied to a single detail tab |
| `orders/lib/` | Lifecycle, flags, quantities, department stages |
| `orders/integrations/` | Google Sheet analytics tied to orders |
| `dashboard/` | Overview KPIs, charts, leaderboards |
| `transportPlanner/` | Transport plan CRUD, calendar, PDFs |
| `pdf/` | PDF templates and builders |
| `profile/` | User profile page |
| `integrations/` | Cross-cutting integrations (e.g. reminders modal) |

## Conventions

- **Domain modals** live under `{domain}/modals/`.
- **Generic modal layout** (`LargeModalPortal`, `modalLayout`) lives under `ui/modals/`.
- Prefer `@/components/portal/shared/...` imports; `@/components/portal` barrel re-exports main route pages only.
