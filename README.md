# PlanGrid

PlanGrid is a static academic study-plan editor for flexible advising sessions.
It provides a configurable semester grid, live Uniandes course search, credit
totals and duplicate warnings, storage for unplaced courses, and browser
autosave.

## Run locally

```bash
./setup.sh
./dev.sh
```

The development server defaults to `http://127.0.0.1:5173`. Override its
address when needed:

```bash
HOST=0.0.0.0 PORT=3000 ./dev.sh
```

## Checks

```bash
./test.sh
./build.sh
./preview.sh
```

The production build is written to `dist/` and uses relative asset paths so it
can be hosted as a static site, including on GitHub Pages.

All utility scripts live in the project root and can be invoked from any
working directory.

## Current sprint

- Vite and strict TypeScript project skeleton
- Core `Course`, `PlannedCourse`, `PlanSemester`, and `StudyPlan` models
- Blank eight-semester study-plan generator
- Configurable semester count and credit limit
- Deterministically colored mock course cards sized by credits
- Live total-credit, overload, and duplicate-course feedback
- Local browser persistence under `plangrid.currentPlan.v1`
- Pure model and validation unit tests
- Uniandes course API adapter with normalized, deduplicated results
- Search by course code or name with development fallback courses

The course API is public but unofficially documented. If it is unavailable,
PlanGrid displays a small set of development fallback courses instead of
blocking plan editing.

## Disclaimer

This is an unofficial planning tool. It does not validate official degree
requirements. Students should confirm final plans with academic coordination or
an advisor.
