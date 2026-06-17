# PlanGrid

PlanGrid is a static academic study-plan editor for advising sessions and
personal planning. It behaves like a flexible whiteboard: courses can be
searched, placed on a credit grid, moved between semesters, stored for later,
and shared without creating an account.

[Open PlanGrid](https://amogusazul.github.io/plangrid/)

PlanGrid is an unofficial tool. It does not validate prerequisites or official
degree requirements.

The `?` button beside the PlanGrid brand opens a short English/Spanish guide
inside the application. The brand itself links back to this repository.

## Features

- Editable semester count, term sequence, plan name, and credit limit
- Uniandes course search by code or name
- Lazy catalog-description search across the Uniandes 2026 catalog
- Catalog/API availability cues for the current 202620 offering API
- Credit-sized cards with cell-snapped drag and drop
- Storage area for unplaced courses
- Duplicate-course, fallback-metadata, catalog-only, unverified, and semester-overload warnings
- Browser autosave using `plangrid.currentPlan.v1`
- Repository-backed blank and ISIS 2026-20 starter presets
- Import and export through sectioned CSV `.plan` files
- Presentation-ready PNG export
- Static deployment with GitHub Pages

## Use PlanGrid

1. Start from the blank plan or choose a preset in the sidebar.
2. Search for a course and drag results into a semester or storage.
3. If current offering search is weak, use **Search catalog descriptions too**
   to search the static 2026 catalog index.
4. Edit the plan title, semester periods, semester count, and credit limit
   directly on the planner.
5. Review warnings without losing the ability to move or add courses.
6. Use **Export Plan** for an editable backup or **Export PNG** for sharing.

Loading a preset or importing a `.plan` file replaces the current autosaved
plan after confirmation.

## Plan Files

`.plan` files are human-readable CSV documents containing three tables:

- `[plan]` stores the format version, plan name, and credit limit.
- `[semesters]` stores semester labels, terms, and course starting slots.
- `[storage]` stores unplaced course codes.

The file stores course codes, names, credits, departments, source/availability
metadata, catalog summaries, plan timestamps, semester placement, and fallback
status. Format version 3 preserves catalog-only courses through a readable
metadata table. During import, PlanGrid still requests current metadata from
the Uniandes course service. Fresh API metadata takes priority for current
planning fields; embedded catalog metadata is preserved for details and used
when the service is unavailable or no course is returned. A synthetic
three-credit card and visible warning are used only when neither source has
metadata.

## Catalog Search

PlanGrid's default search uses the current Uniandes offering API and stays fast.
Thorough catalog search is lazy: the app loads
`public/catalog/catalog-index-2026.json` only when the user asks to search
catalog descriptions. The index is generated from Uniandes SmartCatalog 2026 and
committed as a static asset so GitHub Pages does not need a backend or build-time
network access.

Availability labels mean only whether a course appears in the current `202620`
offering API. They do not indicate seats, schedule fit, future offerings, degree
validity, or requirement approval. Catalog-only courses can still be added as
planning placeholders.

Rebuild the static catalog index with:

```bash
npm run build:catalog
```

The 2026 SmartCatalog page itself describes courses active during 2025; PlanGrid
keeps the source version as `catalogYear: "2026"` because that is the catalog
route and handoff target.

## Run Locally

Requirements:

- Node.js 20 or newer
- npm

```bash
./setup.sh
./dev.sh
```

The development server defaults to `http://127.0.0.1:5173`.

```bash
HOST=0.0.0.0 PORT=3000 ./dev.sh
```

Root-level utility scripts:

```bash
./test.sh
./build.sh
./preview.sh
```

The production build is written to `dist/` with relative asset paths.

## Deploy to GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` runs tests, builds the
site, and deploys `dist/` whenever `main` is updated.

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push or merge the project into `main`, or run the workflow manually from
   the **Actions** tab.

No server, database, secrets, or environment variables are required.

## Architecture

PlanGrid uses Vite, strict TypeScript, native DOM rendering, native drag and
drop, Vitest, MiniSearch, and `html-to-image`. API responses are normalized
behind `src/api/courseApi.ts`; catalog search lives behind lazy client-side
search modules; plan validation, persistence, presets, and file serialization
remain independent from the UI.

## Disclaimer

This is an unofficial planning tool. It does not certify graduation
requirements. Students should confirm final plans with academic coordination
or an advisor.

The included ISIS starter is an editable planning aid based on the official
2026-20 navigation diagram, not a complete or authoritative curriculum.

## License

MIT. See `LICENSE`.
