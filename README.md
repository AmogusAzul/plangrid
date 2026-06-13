# PlanGrid

PlanGrid is a static academic study-plan editor for advising sessions and
personal planning. It behaves like a flexible whiteboard: courses can be
searched, placed on a credit grid, moved between semesters, stored for later,
and shared without creating an account.

PlanGrid is an unofficial tool. It does not validate prerequisites or official
degree requirements.

## Features

- Editable semester count, term sequence, plan name, and credit limit
- Uniandes course search by code or name
- Credit-sized cards with cell-snapped drag and drop
- Storage area for unplaced courses
- Duplicate-course, fallback-metadata, and semester-overload warnings
- Browser autosave using `plangrid.currentPlan.v1`
- Repository-backed blank and ISIS 2026-20 starter presets
- Import and export through sectioned CSV `.plan` files
- Presentation-ready PNG export
- Static deployment with GitHub Pages

## Use PlanGrid

1. Start from the blank plan or choose a preset in the sidebar.
2. Search for a course and add it to the selected semester or storage.
3. Drag cards between semesters, storage, or specific credit cells.
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

Only course codes are stored. During import, PlanGrid fetches current course
metadata from the Uniandes course service. If metadata cannot be fetched, the
course remains usable with three fallback credits and a visible warning.

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
drop, Vitest, and `html-to-image`. API responses are normalized behind
`src/api/courseApi.ts`; plan validation, persistence, presets, and file
serialization remain independent from the UI.

## Disclaimer

This is an unofficial planning tool. It does not certify graduation
requirements. Students should confirm final plans with academic coordination
or an advisor.

The included ISIS starter is an editable planning aid based on the official
2026-20 navigation diagram, not a complete or authoritative curriculum.

## License

MIT. See `LICENSE`.
