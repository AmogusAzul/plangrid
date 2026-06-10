# PlanGrid

PlanGrid is a static academic study-plan editor for flexible advising sessions.
Sprint 1 provides a configurable semester grid, mock course catalog, live credit
totals and duplicate warnings, storage for unplaced courses, and browser
autosave.

## Run locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm test
npm run build
```

The production build is written to `dist/` and uses relative asset paths so it
can be hosted as a static site, including on GitHub Pages.

## Current sprint

- Vite and strict TypeScript project skeleton
- Core `Course`, `PlannedCourse`, `PlanSemester`, and `StudyPlan` models
- Blank eight-semester study-plan generator
- Configurable semester count and credit limit
- Deterministically colored mock course cards sized by credits
- Live total-credit, overload, and duplicate-course feedback
- Local browser persistence under `plangrid.currentPlan.v1`
- Pure model and validation unit tests

Course search currently uses development fixtures. The Uniandes API adapter is
planned for Sprint 2.

## Disclaimer

This is an unofficial planning tool. It does not validate official degree
requirements. Students should confirm final plans with academic coordination or
an advisor.

