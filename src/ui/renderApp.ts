import type { Course, PlannedCourse } from "../models/course";
import type { CourseSearchState } from "../models/courseSearch";
import type { SearchAppearanceSettings } from "../models/searchAppearance";
import type { CourseSearchResult, SearchFilters } from "../models/searchResult";
import type { StudyPlan } from "../models/studyPlan";
import { mockCourses } from "../presets/mockCourses";
import { planPresets } from "../presets/planPresets";
import { STORAGE_DESTINATION } from "../state/courseDestination";
import { addCourse, deleteCourse, moveCourse } from "../state/planCourses";
import {
  isRegularTerm,
  resizeSemesters,
  updateSemesterTerm,
} from "../state/planFactory";
import {
  getSemesterGridColumns,
  positionSemesterCourses,
  SEMESTER_GRID_COLUMNS,
  type PositionedCourse,
} from "../state/semesterLayout";
import {
  getTotalPlanCredits,
  sumCredits,
  validatePlan,
} from "../validation/validatePlan";
import { getCourseColor, getCoursePalette } from "./courseColor";
import {
  COURSE_DRAG_TYPE,
  getGrabOffsetRatio,
  getSnappedCourseStart,
  parseCourseDrag,
  serializeCourseDrag,
  type CourseDragPayload,
} from "./courseDrag";
import { captureAppScroll, restoreAppScroll } from "./appScroll";

type AppActions = {
  updatePlan: (update: (plan: StudyPlan) => StudyPlan) => void;
  resetPlan: () => void;
  exportPNG: (planner: HTMLElement, planName: string) => Promise<void>;
  exportPlan: () => void;
  importPlan: (file: File) => Promise<string[]>;
  loadPreset: (presetId: string) => Promise<string[]>;
  updateSearchFilters: (filters: SearchFilters) => void;
  updateSearchAppearance: (settings: SearchAppearanceSettings) => void;
  showCourseDetails: (course: Course) => void;
  closeCourseDetails: () => void;
  search: (query: string, mode?: "fast" | "catalog") => Promise<void>;
};

const mainClass: string = "planner";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function courseCard(
  course: PlannedCourse,
  affectedCourseCodes: Set<string>,
  location: "semester" | "storage",
  useMutedCatalogOnlyCards: boolean,
  position?: PositionedCourse,
): string {
  const palette = getCoursePalette(course);
  const warningBadge = affectedCourseCodes.has(course.code)
    ? '<span class="course-card__warning" role="img" aria-label="Course warning" title="Course warning">!</span>'
    : "";
  const moveAction =
    location === "semester"
      ? `<button class="course-card__action" data-store-course="${escapeHtml(course.id)}" title="Move to storage">Store</button>`
      : "";
  const isCatalogOnly = course.availability === "catalog-only";
  const source = course.availability ?? "api-available";

  return `
    <article
      class="course-card"
      style="--course-span: ${position?.span ?? Math.max(1, course.credits)}; --course-column: ${position?.column ?? 1}; --course-color: ${palette.background}"
      data-course-id="${escapeHtml(course.id)}"
      data-source="${escapeHtml(source)}"
      data-muted-catalog-only="${isCatalogOnly && useMutedCatalogOnlyCards ? "true" : "false"}"
      draggable="true"
      title="Drag to another semester or storage"
    >
      ${warningBadge}
      <strong>${escapeHtml(course.code)}</strong>
      <span>${escapeHtml(course.name)}</span>
      <small>${course.credits} cr</small>
      <div class="course-card__actions">
        ${moveAction}
        <button class="course-card__action" data-course-details="${escapeHtml(course.id)}" title="Course details">Details</button>
        <button class="course-card__action" data-remove-course="${escapeHtml(course.id)}" title="Remove course">Remove</button>
      </div>
    </article>
  `;
}

function availabilityText(course: Course): string {
  if (course.availability === "catalog-only") return "Catalog";
  if (course.availability === "unknown") return "Unverified";
  return "Current";
}

function catalogCourseItem(course: CourseSearchResult): string {
  const snippet = course.matchedSnippet || course.catalog?.matchedSnippet;
  return `
    <li
      class="catalog-course"
      data-catalog-course="${escapeHtml(course.code)}"
      draggable="true"
      title="Drag into a semester or storage"
    >
      <span class="catalog-course__swatch" style="--course-color: ${getCourseColor(course)}"></span>
      <div>
        <strong>${escapeHtml(course.code)}</strong>
        <span>${escapeHtml(course.name)}</span>
        ${snippet ? `<p class="catalog-course__snippet">... ${escapeHtml(snippet)} ...</p>` : ""}
      </div>
      <small>${course.credits} cr</small>
      <button type="button" data-result-details="${escapeHtml(course.code)}" title="Course details">${escapeHtml(availabilityText(course))}</button>
    </li>
  `;
}

function searchContent(search: CourseSearchState): string {
  if (search.status === "loading") {
    return '<p class="search-status">Searching the Uniandes course catalog...</p>';
  }
  if (search.status === "catalog-loading") {
    return '<p class="search-status">Searching catalog descriptions across departments...</p>';
  }

  if (search.status === "error") {
    return `
      <div class="search-error" role="alert">
        <strong>Live search unavailable</strong>
        <span>${escapeHtml(search.error ?? "Course search failed.")}</span>
      </div>
      <p class="catalog-label">Development fallback courses</p>
      <ul class="catalog-list">
        ${mockCourses.map((course) =>
          catalogCourseItem({
            ...course,
            source: "api",
            metadataSource: "api",
            availability: "api-available",
          }),
        ).join("")}
      </ul>
    `;
  }

  if (search.status === "success") {
    if (search.results.length === 0) {
      return `
        <p class="search-status">No courses found for "${escapeHtml(search.query)}".</p>
        ${
          search.mode === "fast"
            ? '<button class="catalog-search-prompt" type="button" id="catalog-search">Try thorough catalog search</button>'
            : ""
        }
      `;
    }

    return `
      <p class="catalog-label">${search.mode === "catalog" ? "Catalog results" : `${search.results.length} unique courses found`}</p>
      ${
        search.mode === "fast" && search.results.length < 3
          ? '<button class="catalog-search-prompt" type="button" id="catalog-search">Search catalog descriptions too</button>'
          : ""
      }
      <ul class="catalog-list">
        ${search.results.map(catalogCourseItem).join("")}
      </ul>
    `;
  }

  return '<p class="search-status">Search by code, name, or requirement such as CBU, CLE, EC, EING, or EP.</p>';
}

function departmentFilterOptions(search: CourseSearchState): string {
  const departments = [
    ...new Set(
      search.results
        .map((result) => result.department)
        .filter((department): department is string => Boolean(department)),
    ),
  ].sort();

  return [
    `<option value="all" ${search.filters.department === "all" ? "selected" : ""}>All departments</option>`,
    ...departments.map(
      (department) =>
        `<option value="${escapeHtml(department)}" ${search.filters.department === department ? "selected" : ""}>${escapeHtml(department)}</option>`,
    ),
  ].join("");
}

function allPlannedCourses(plan: StudyPlan): PlannedCourse[] {
  return [
    ...plan.semesters.flatMap((semester) => semester.courses),
    ...plan.storage,
  ];
}

export function renderApp(
  root: HTMLElement,
  plan: StudyPlan,
  search: CourseSearchState,
  searchAppearance: SearchAppearanceSettings,
  selectedDetailsCourse: Course | null,
  actions: AppActions,
): void {
  const scrollPosition = captureAppScroll(root);
  const warnings = validatePlan(plan);
  const affectedCourseCodes = new Set(
    warnings.flatMap((warning) => warning.relatedCourseCodes ?? []),
  );
  const overloadedSemesters = new Set(
    warnings.flatMap((warning) => warning.relatedSemesterIds ?? []),
  );

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <a
          class="brand"
          href="https://github.com/AmogusAzul/plangrid"
          target="_blank"
          rel="noreferrer"
          aria-label="Open the PlanGrid GitHub repository"
        >
          <span class="brand__mark">PG</span>
          <span>PlanGrid</span>
        </a>
        <button
          class="help-button"
          id="open-help"
          type="button"
          aria-label="What is PlanGrid and how is it used?"
          title="About PlanGrid"
        >?</button>
        <div class="header-actions">
          <span class="save-status">Autosaved locally</span>
          <button class="button button--ghost" id="export-png">Export PNG</button>
          <button class="button button--ghost" id="export-plan">Export Plan</button>
          <button class="button button--ghost" id="import-plan">Import Plan</button>
          <input id="import-plan-file" type="file" accept=".plan,text/csv" hidden />
          <button class="button button--ghost button--danger" id="reset-plan">Reset</button>
        </div>
      </header>

      <dialog class="help-dialog" id="help-dialog" aria-labelledby="help-title">
        <div class="help-dialog__header">
          <div>
            <span class="eyebrow">PlanGrid guide</span>
            <h2 id="help-title">What is PlanGrid?</h2>
          </div>
          <button class="help-dialog__close" id="close-help" type="button" aria-label="Close guide">Close</button>
        </div>
        <div class="help-tabs" role="tablist" aria-label="Guide language">
          <button
            class="help-tab help-tab--active"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="help-english"
            data-help-language="english"
          >English</button>
          <button
            class="help-tab"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="help-spanish"
            data-help-language="spanish"
          >Español</button>
        </div>
        <section class="help-content" id="help-english" data-help-panel="english" role="tabpanel">
          <p>
            PlanGrid is an unofficial academic planning whiteboard. It helps students
            and advisors explore semester-by-semester plans; it does not certify degree
            requirements.
          </p>
          <ol>
            <li>Start with a blank plan or a preset.</li>
            <li>Search for courses by code, name, or a requirement such as CBU or EP.</li>
            <li>Add or drag cards into semesters, exact credit cells, or Storage.</li>
            <li>Edit the title, periods, semester count, and credit limit directly.</li>
            <li>Review warnings, then export an editable .plan file or a shareable PNG.</li>
          </ol>
          <p>Your work is autosaved only in this browser.</p>
        </section>
        <section class="help-content" id="help-spanish" data-help-panel="spanish" role="tabpanel" hidden>
          <p>
            PlanGrid es un tablero no oficial de planeación académica. Ayuda a
            estudiantes y consejeros a explorar planes semestre por semestre; no
            certifica requisitos de grado.
          </p>
          <ol>
            <li>Empieza con un plan vacío o una plantilla.</li>
            <li>Busca cursos por código, nombre o un requisito como CBU o EP.</li>
            <li>Agrega o arrastra tarjetas a semestres, celdas de crédito o Storage.</li>
            <li>Edita directamente el título, los periodos, semestres y límite de créditos.</li>
            <li>Revisa las alertas y exporta un archivo .plan editable o una imagen PNG.</li>
          </ol>
          <p>Tu trabajo se guarda automáticamente únicamente en este navegador.</p>
        </section>
      </dialog>
      ${
        selectedDetailsCourse
          ? `<aside class="course-details" role="dialog" aria-label="Course details">
              <div class="course-details__panel">
                <button class="help-dialog__close" id="close-course-details" type="button" aria-label="Close details">Close</button>
                <span class="eyebrow">${escapeHtml(selectedDetailsCourse.department ?? selectedDetailsCourse.code.split("-", 1)[0] ?? "Course")}</span>
                <h2>${escapeHtml(selectedDetailsCourse.code)} — ${escapeHtml(selectedDetailsCourse.name)}</h2>
                <p class="course-details__meta">
                  ${selectedDetailsCourse.credits} credits · ${escapeHtml(selectedDetailsCourse.metadataSource ?? "api")} · ${escapeHtml(availabilityText(selectedDetailsCourse))}
                </p>
                ${
                  selectedDetailsCourse.catalog?.description
                    ? `<section><h3>Description</h3><p>${escapeHtml(selectedDetailsCourse.catalog.description)}</p></section>`
                    : '<section><h3>Description</h3><p>No catalog description is saved for this course.</p></section>'
                }
                <section>
                  <h3>Availability</h3>
                  <p>${
                    selectedDetailsCourse.availability === "catalog-only"
                      ? "Found in the 2026 catalog, but not found in the current 202620 offering API."
                      : selectedDetailsCourse.availability === "unknown"
                        ? "Could not verify this course against the current 202620 offering API."
                        : "Found in the current 202620 offering API."
                  }</p>
                </section>
                ${
                  selectedDetailsCourse.catalog?.catalogUrl
                    ? `<a class="course-details__link" href="${escapeHtml(selectedDetailsCourse.catalog.catalogUrl)}" target="_blank" rel="noreferrer">Open catalog source</a>`
                    : ""
                }
              </div>
            </aside>`
          : ""
      }

      <aside class="sidebar">
        <section class="panel warnings-panel" aria-live="polite">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Plan health</span>
              <h2>Warnings</h2>
            </div>
            <span class="count-badge">${warnings.length}</span>
          </div>
          ${
            warnings.length > 0
              ? `<ul class="warning-list">${warnings
                  .map(
                    (warning) =>
                      `<li data-warning-id="${escapeHtml(warning.id)}"><span aria-hidden="true">!</span><p>${escapeHtml(warning.message)}</p></li>`,
                  )
                  .join("")}</ul>`
              : '<p class="empty-state empty-state--success">No plan warnings.</p>'
          }
        </section>

        <section class="panel storage-panel">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Unplaced</span>
              <h2>Storage</h2>
            </div>
            <span class="count-badge">${plan.storage.length}</span>
          </div>
          <div
            class="storage-track drop-zone"
            data-drop-destination="${STORAGE_DESTINATION}"
            aria-label="Unplaced course storage drop zone"
          >
            ${
              plan.storage.length > 0
                ? plan.storage
                    .map((course) =>
                      courseCard(
                        course,
                        affectedCourseCodes,
                        "storage",
                        searchAppearance.useMutedCatalogOnlyCards,
                      ),
                    )
                    .join("")
                : '<p class="empty-state">Drop unplaced courses here.</p>'
            }
          </div>
        </section>

        <section class="panel course-search-panel">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Uniandes catalog</span>
              <h2>Add courses</h2>
            </div>
          </div>
          <form class="course-search" id="course-search-form">
            <label for="course-query">Course code, name, or requirement</label>
            <div>
              <input
                id="course-query"
                name="query"
                type="search"
                value="${escapeHtml(search.query)}"
                placeholder="ISIS-1225, estructuras, or EP"
                autocomplete="off"
                required
              />
              <button type="submit" ${search.status === "loading" ? "disabled" : ""}>
                ${search.status === "loading" ? "Searching" : "Search"}
              </button>
            </div>
          </form>
          <div class="search-filters">
            <label>
              <span>Department</span>
              <select id="department-filter">
                ${departmentFilterOptions(search)}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select id="source-filter">
                <option value="all" ${search.filters.source === "all" ? "selected" : ""}>All sources</option>
                <option value="api-available" ${search.filters.source === "api-available" ? "selected" : ""}>Current API</option>
                <option value="catalog-only" ${search.filters.source === "catalog-only" ? "selected" : ""}>Catalog only</option>
                <option value="unknown" ${search.filters.source === "unknown" ? "selected" : ""}>Unverified</option>
              </select>
            </label>
          </div>
          <label class="catalog-appearance-toggle">
            <input id="muted-catalog-only" type="checkbox" ${searchAppearance.useMutedCatalogOnlyCards ? "checked" : ""} />
            <span>Muted catalog-only cards</span>
          </label>
          <p class="drag-hint">Drag any result directly into a semester or storage.</p>
          <div class="search-results" aria-live="polite">
            ${searchContent(search)}
          </div>
        </section>

        <section class="panel presets-panel">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Starting points</span>
              <h2>Presets</h2>
            </div>
            <span class="count-badge">${planPresets.length}</span>
          </div>
          <div class="preset-list">
            ${planPresets
              .map(
                (preset) => `
                  <article class="preset-card">
                    <div>
                      <strong>${escapeHtml(preset.name)}</strong>
                      <p>${escapeHtml(preset.description)}</p>
                    </div>
                    <button data-load-preset="${escapeHtml(preset.id)}">Use preset</button>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>

      </aside>

      <main class="${mainClass}">
        <section class="planner-toolbar">
          <label class="roadmap-title" for="plan-name">
            <span class="eyebrow">Academic roadmap</span>
            <input
              id="plan-name"
              value="${escapeHtml(plan.name)}"
              size="${Math.max(8, plan.name.length)}"
              aria-label="Plan name"
            />
          </label>
          <div class="plan-stats">
            <div class="plan-total-card">
              <strong>${getTotalPlanCredits(plan)}</strong>
              <span>Total plan credits</span>
            </div>
            <label>
              <span>Semesters</span>
              <input id="semester-count" type="number" min="1" max="16" value="${plan.semesters.length}" />
            </label>
            <label>
              <span>Credit limit</span>
              <input id="credit-limit" type="number" min="1" max="30" value="${plan.creditLimitPerSemester}" />
            </label>
          </div>
        </section>

        <section class="semester-list" aria-label="Study plan semesters">
          ${plan.semesters
            .map((semester, semesterIndex) => {
              const credits = sumCredits(semester.courses);
              const isOverloaded = overloadedSemesters.has(semester.id);
              const hasCourseWarning = semester.courses.some((course) =>
                affectedCourseCodes.has(course.code),
              );
              const hasWarning = isOverloaded || hasCourseWarning;
              const capacityPercent = Math.min(
                100,
                (credits / plan.creditLimitPerSemester) * 100,
              );
              const positions = positionSemesterCourses(semester.courses);
              const gridColumns = getSemesterGridColumns(
                semester.courses,
                plan.creditLimitPerSemester,
              );

              return `
                <article class="semester-row ${hasWarning ? "semester-row--warning" : ""}">
                  <header class="semester-meta">
                    <label class="semester-term-editor">
                      ${semesterIndex === 0 ? "<span>Edit first period</span>" : ""}
                      <input
                        data-semester-term="${escapeHtml(semester.id)}"
                        value="${escapeHtml(semester.termHint)}"
                        size="${semester.termHint.length}"
                        pattern="\\d{4}-(10|20)"
                        title="Use a regular term in YYYY-10 or YYYY-20 format"
                        aria-label="${escapeHtml(semester.label)} period"
                      />
                    </label>
                    <h2>${escapeHtml(semester.label)}</h2>
                    <strong>${credits} / ${plan.creditLimitPerSemester} credits${isOverloaded ? " !" : ""}</strong>
                    <div
                      class="credit-meter"
                      role="meter"
                      aria-label="${escapeHtml(semester.label)} credit load"
                      aria-valuemin="0"
                      aria-valuemax="${plan.creditLimitPerSemester}"
                      aria-valuenow="${credits}"
                    >
                      <span style="width: ${capacityPercent}%"></span>
                    </div>
                  </header>
                  <div
                    class="semester-track drop-zone"
                    style="--grid-columns: ${gridColumns}"
                    data-drop-destination="${escapeHtml(semester.id)}"
                    data-grid-columns="${gridColumns}"
                    aria-label="${escapeHtml(semester.label)} course drop zone"
                  >
                    ${
                      semester.courses.length > 0
                        ? positions.map((position) =>
                              courseCard(
                                position.course,
                                affectedCourseCodes,
                                "semester",
                                searchAppearance.useMutedCatalogOnlyCards,
                                position,
                              ),
                            ).join("")
                        : '<p class="semester-empty">Drop courses here</p>'
                    }
                  </div>
                </article>
              `;
            })
            .join("")}
        </section>

        <p class="disclaimer">
          Unofficial planning tool. Confirm final plans with academic coordination or an advisor.
        </p>
      </main>
    </div>
  `;
  restoreAppScroll(root, scrollPosition);

  root.querySelector<HTMLInputElement>("#plan-name")?.addEventListener("change", (event) => {
    const name = (event.currentTarget as HTMLInputElement).value.trim();
    actions.updatePlan((current) => ({ ...current, name: name || "Untitled plan" }));
  });

  const planNameInput =
    root.querySelector<HTMLInputElement>("#plan-name");

  root.querySelectorAll<HTMLInputElement>(".roadmap-title input, .semester-term-editor input").forEach((input) => {
    input.addEventListener("input", () => {
      input.size = Math.max(input === planNameInput ? 8 : 1, input.value.length);
    });
  });

  root.querySelector<HTMLInputElement>("#semester-count")?.addEventListener("change", (event) => {
    const count = Number((event.currentTarget as HTMLInputElement).value);
    actions.updatePlan((current) => resizeSemesters(current, count));
  });

  root.querySelector<HTMLInputElement>("#credit-limit")?.addEventListener("change", (event) => {
    const limit = Number((event.currentTarget as HTMLInputElement).value);
    actions.updatePlan((current) => ({
      ...current,
      creditLimitPerSemester: Math.min(30, Math.max(1, Math.trunc(limit))),
    }));
  });

  function updateTermInput(
    input: HTMLInputElement,
    update: (term: string) => void,
  ): void {
    const term = input.value.trim();

    if (!isRegularTerm(term)) {
      input.setCustomValidity("Use YYYY-10 or YYYY-20.");
      input.reportValidity();
      return;
    }

    input.setCustomValidity("");
    update(term);
  }

  root.querySelectorAll<HTMLInputElement>("[data-semester-term]").forEach((input) => {
    input.addEventListener("change", () => {
      const semesterId = input.dataset.semesterTerm;
      if (!semesterId) return;

      updateTermInput(input, (term) => {
        actions.updatePlan((current) =>
          updateSemesterTerm(current, semesterId, term),
        );
      });
    });
  });

  root.querySelector<HTMLFormElement>("#course-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const query = String(formData.get("query") ?? "");
    void actions.search(query);
  });

  root.querySelector<HTMLButtonElement>("#catalog-search")?.addEventListener("click", () => {
    void actions.search(search.query, "catalog");
  });

  function updateFilters(): void {
    const department =
      root.querySelector<HTMLSelectElement>("#department-filter")?.value ??
      search.filters.department;
    const source =
      root.querySelector<HTMLSelectElement>("#source-filter")?.value ??
      search.filters.source;
    actions.updateSearchFilters({
      department,
      source: source as SearchFilters["source"],
    });
    if (search.query) {
      void actions.search(search.query, search.mode);
    }
  }

  root.querySelector<HTMLSelectElement>("#department-filter")?.addEventListener("change", updateFilters);
  root.querySelector<HTMLSelectElement>("#source-filter")?.addEventListener("change", updateFilters);
  root.querySelector<HTMLInputElement>("#muted-catalog-only")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    actions.updateSearchAppearance({
      useMutedCatalogOnlyCards: input.checked,
    });
  });

  const availableCourses = new Map(
    [
      ...search.results,
      ...(search.status === "error"
        ? mockCourses.map((course) => ({
            ...course,
            source: "api" as const,
            metadataSource: "api" as const,
            availability: "api-available" as const,
          }))
        : []),
    ].map((course) => [course.code, course]),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-result-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const course = availableCourses.get(button.dataset.resultDetails ?? "");
      if (course) actions.showCourseDetails(course);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-course-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const course = allPlannedCourses(plan).find(
        (entry) => entry.id === button.dataset.courseDetails,
      );
      if (course) actions.showCourseDetails(course);
    });
  });

  root.querySelector<HTMLButtonElement>("#close-course-details")?.addEventListener("click", () => {
    actions.closeCourseDetails();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-remove-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.dataset.removeCourse;
      if (!courseId) return;
      actions.updatePlan((current) => deleteCourse(current, courseId));
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-store-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.dataset.storeCourse;
      if (!courseId) return;
      actions.updatePlan((current) =>
        moveCourse(current, courseId, STORAGE_DESTINATION),
      );
    });
  });

  let activeDrag: CourseDragPayload | null = null;

  function clearDragStyles(): void {
    root.querySelectorAll(".is-dragging, .drop-zone--active").forEach((element) => {
      element.classList.remove("is-dragging", "drop-zone--active");
    });
    root.querySelectorAll(".drop-slot-indicator").forEach((element) => {
      element.remove();
    });
    root.querySelectorAll<HTMLElement>("[data-drop-slot]").forEach((element) => {
      delete element.dataset.dropSlot;
    });
    activeDrag = null;
  }

  function getDraggedCourseSpan(payload: CourseDragPayload): number {
    if (payload.kind === "catalog-course") {
      return Math.min(
        SEMESTER_GRID_COLUMNS,
        Math.max(1, availableCourses.get(payload.courseCode)?.credits ?? 1),
      );
    }

    const plannedCourse = allPlannedCourses(plan).find(
      (course) => course.id === payload.courseId,
    );

    return Math.min(
      SEMESTER_GRID_COLUMNS,
      Math.max(1, plannedCourse?.credits ?? 1),
    );
  }

  function getDropSlot(
    zone: HTMLElement,
    event: DragEvent,
    span: number,
    grabOffsetRatio: number,
  ): number {
    const styles = getComputedStyle(zone);
    const bounds = zone.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const columnGap = Number.parseFloat(styles.columnGap) || 0;
    const gridColumns = Math.max(
      1,
      Number(zone.dataset.gridColumns) || SEMESTER_GRID_COLUMNS,
    );
    const contentWidth = bounds.width - paddingLeft - paddingRight;
    const x = Math.max(
      0,
      Math.min(contentWidth - 1, event.clientX - bounds.left - paddingLeft),
    );
    const column = getSnappedCourseStart(
      x,
      contentWidth,
      gridColumns,
      span,
      columnGap,
      grabOffsetRatio,
    );

    return column;
  }

  function showDropSlot(
    zone: HTMLElement,
    slotStart: number,
    span: number,
  ): void {
    let indicator = zone.querySelector<HTMLElement>(".drop-slot-indicator");

    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "drop-slot-indicator";
      zone.append(indicator);
    }

    indicator.style.gridColumn = `${slotStart} / span ${span}`;
  }

  function getGrabOffset(
    event: DragEvent,
    element: HTMLElement,
  ): number {
    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) return 0;

    return getGrabOffsetRatio(
      event.clientX - bounds.left,
      bounds.width,
    );
  }

  function beginDrag(
    event: DragEvent,
    element: HTMLElement,
    payload: CourseDragPayload,
  ): void {
    if (!event.dataTransfer) return;

    activeDrag = payload;
    element.classList.add("is-dragging");
    event.dataTransfer.effectAllowed =
      payload.kind === "catalog-course" ? "copy" : "move";
    const serialized = serializeCourseDrag(payload);
    event.dataTransfer.setData(COURSE_DRAG_TYPE, serialized);
    event.dataTransfer.setData("text/plain", serialized);
  }

  root.querySelectorAll<HTMLElement>("[data-course-id]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const courseId = card.dataset.courseId;
      if (!courseId) return;
      beginDrag(event, card, {
        kind: "planned-course",
        courseId,
        grabOffsetRatio: getGrabOffset(event, card),
      });
    });
    card.addEventListener("dragend", clearDragStyles);
  });

  root.querySelectorAll<HTMLElement>("[data-catalog-course]").forEach((result) => {
    result.addEventListener("dragstart", (event) => {
      const courseCode = result.dataset.catalogCourse;
      if (!courseCode) return;
      beginDrag(event, result, {
        kind: "catalog-course",
        courseCode,
        grabOffsetRatio: getGrabOffset(event, result),
      });
    });
    result.addEventListener("dragend", clearDragStyles);
  });

  root.querySelectorAll<HTMLElement>("[data-drop-destination]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      if (!activeDrag || !event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect =
        activeDrag.kind === "catalog-course" ? "copy" : "move";
      zone.classList.add("drop-zone--active");

      if (zone.dataset.dropDestination !== STORAGE_DESTINATION) {
        const span = getDraggedCourseSpan(activeDrag);
        const slotStart = getDropSlot(
          zone,
          event,
          span,
          activeDrag.grabOffsetRatio,
        );
        zone.dataset.dropSlot = String(slotStart);
        showDropSlot(zone, slotStart, span);
      }
    });

    zone.addEventListener("dragleave", (event) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && zone.contains(nextTarget)) return;
      zone.classList.remove("drop-zone--active");
      zone.querySelector(".drop-slot-indicator")?.remove();
      delete zone.dataset.dropSlot;
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      const destination = zone.dataset.dropDestination;
      const requestedSlot =
        destination === STORAGE_DESTINATION
          ? undefined
          : Number(zone.dataset.dropSlot);
      const serialized =
        event.dataTransfer?.getData(COURSE_DRAG_TYPE) ||
        event.dataTransfer?.getData("text/plain") ||
        "";
      const payload = parseCourseDrag(serialized);
      clearDragStyles();

      if (!destination || !payload) return;

      if (payload.kind === "planned-course") {
        actions.updatePlan((current) =>
          moveCourse(
            current,
            payload.courseId,
            destination,
            Number.isFinite(requestedSlot) ? requestedSlot : undefined,
          ),
        );
        return;
      }

      const course = availableCourses.get(payload.courseCode);
      if (!course) return;
      actions.updatePlan((current) =>
        addCourse(
          current,
          course,
          destination,
          Number.isFinite(requestedSlot) ? requestedSlot : undefined,
        ),
      );
    });
  });

  root.querySelector<HTMLButtonElement>("#reset-plan")?.addEventListener("click", () => {
    if (window.confirm("Reset the current plan and remove the local autosave?")) {
      actions.resetPlan();
    }
  });

  const helpDialog =
    root.querySelector<HTMLDialogElement>("#help-dialog");

  root.querySelector<HTMLButtonElement>("#open-help")?.addEventListener("click", () => {
    helpDialog?.showModal();
  });

  root.querySelector<HTMLButtonElement>("#close-help")?.addEventListener("click", () => {
    helpDialog?.close();
  });

  helpDialog?.addEventListener("click", (event) => {
    if (event.target === helpDialog) {
      helpDialog.close();
    }
  });

  root.querySelectorAll<HTMLButtonElement>("[data-help-language]").forEach((button) => {
    button.addEventListener("click", () => {
      const language = button.dataset.helpLanguage;
      if (!language) return;

      root.querySelectorAll<HTMLButtonElement>("[data-help-language]").forEach((tab) => {
        const isActive = tab.dataset.helpLanguage === language;
        tab.classList.toggle("help-tab--active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      root.querySelectorAll<HTMLElement>("[data-help-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.helpPanel !== language;
      });
    });
  });

  root.querySelector<HTMLButtonElement>("#export-png")?.addEventListener("click", () => {
    const planner = root.querySelector<HTMLElement>(`.${mainClass}`);
    const planName =
      root.querySelector<HTMLInputElement>("#plan-name")?.value ?? plan.name;

    if (!planner) return;

    void actions.exportPNG(planner, planName).catch(() => {
      window.alert("The plan image could not be exported.");
    });
  });

  root.querySelector<HTMLButtonElement>("#export-plan")?.addEventListener("click", () => {
    actions.exportPlan();
  });

  const importInput =
    root.querySelector<HTMLInputElement>("#import-plan-file");

  root.querySelector<HTMLButtonElement>("#import-plan")?.addEventListener("click", () => {
    importInput?.click();
  });

  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    importInput.value = "";

    if (file && !file.name.toLowerCase().endsWith(".plan")) {
      window.alert("Choose a PlanGrid file with the .plan extension.");
      return;
    }

    if (
      !file ||
      !window.confirm(
        "Import this plan and replace the current locally saved plan?",
      )
    ) {
      return;
    }

    void actions.importPlan(file).then((fallbackCodes) => {
      if (fallbackCodes.length > 0) {
        window.alert(
          `Plan imported. Metadata could not be fetched for: ${fallbackCodes.join(", ")}. Fallback credits were used.`,
        );
      }
    }).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "The plan file is invalid.";
      window.alert(`The plan could not be imported: ${message}`);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-load-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const presetId = button.dataset.loadPreset;
      if (
        !presetId ||
        !window.confirm(
          "Load this preset and replace the current locally saved plan?",
        )
      ) {
        return;
      }

      const presetButtons =
        root.querySelectorAll<HTMLButtonElement>("[data-load-preset]");
      presetButtons.forEach((entry) => {
        entry.disabled = true;
      });
      button.textContent = "Loading...";

      void actions.loadPreset(presetId).then((fallbackCodes) => {
        if (fallbackCodes.length > 0) {
          window.alert(
            `Preset loaded. Metadata could not be fetched for: ${fallbackCodes.join(", ")}. Fallback credits were used.`,
          );
        }
      }).catch((error: unknown) => {
        presetButtons.forEach((entry) => {
          entry.disabled = false;
          entry.textContent = "Use preset";
        });
        const message =
          error instanceof Error ? error.message : "The preset could not be loaded.";
        window.alert(message);
      });
    });
  });

}
