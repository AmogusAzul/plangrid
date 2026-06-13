import type { Course, PlannedCourse } from "../models/course";
import type { CourseSearchState } from "../models/courseSearch";
import type { StudyPlan } from "../models/studyPlan";
import { mockCourses } from "../presets/mockCourses";
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

type AppActions = {
  updatePlan: (update: (plan: StudyPlan) => StudyPlan) => void;
  resetPlan: () => void;
  exportPNG: (root: string) => void;
  setCourseDestination: (destination: string) => void;
  search: (query: string) => Promise<void>;
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
  duplicatedCodes: Set<string>,
  location: "semester" | "storage",
  canPlace = true,
  position?: PositionedCourse,
): string {
  const palette = getCoursePalette(course);
  const duplicateBadge = duplicatedCodes.has(course.code)
    ? '<span class="course-card__warning" role="img" aria-label="Warning: duplicate course" title="Duplicate course">!</span>'
    : "";
  const moveAction =
    location === "storage"
      ? `<button class="course-card__action" data-place-course="${escapeHtml(course.id)}" title="${canPlace ? "Place in the selected semester" : "Select a semester before placing"}" ${canPlace ? "" : "disabled"}>Place</button>`
      : `<button class="course-card__action" data-store-course="${escapeHtml(course.id)}" title="Move to storage">Store</button>`;

  return `
    <article
      class="course-card"
      style="--course-span: ${position?.span ?? Math.max(1, course.credits)}; --course-column: ${position?.column ?? 1}; --course-color: ${palette.background}"
      data-course-id="${escapeHtml(course.id)}"
      draggable="true"
      title="Drag to another semester or storage"
    >
      ${duplicateBadge}
      <strong>${escapeHtml(course.code)}</strong>
      <span>${escapeHtml(course.name)}</span>
      <small>${course.credits} cr</small>
      <div class="course-card__actions">
        ${moveAction}
        <button class="course-card__action" data-remove-course="${escapeHtml(course.id)}" title="Remove course">Remove</button>
      </div>
    </article>
  `;
}

function catalogCourseItem(course: Course): string {
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
      </div>
      <small>${course.credits} cr</small>
      <button data-add-course="${escapeHtml(course.code)}">Add</button>
    </li>
  `;
}

function searchContent(search: CourseSearchState): string {
  if (search.status === "loading") {
    return '<p class="search-status">Searching the Uniandes course catalog...</p>';
  }

  if (search.status === "error") {
    return `
      <div class="search-error" role="alert">
        <strong>Live search unavailable</strong>
        <span>${escapeHtml(search.error ?? "Course search failed.")}</span>
      </div>
      <p class="catalog-label">Development fallback courses</p>
      <ul class="catalog-list">
        ${mockCourses.map(catalogCourseItem).join("")}
      </ul>
    `;
  }

  if (search.status === "success") {
    if (search.results.length === 0) {
      return `<p class="search-status">No courses found for "${escapeHtml(search.query)}".</p>`;
    }

    return `
      <p class="catalog-label">${search.results.length} unique courses found</p>
      <ul class="catalog-list">
        ${search.results.map(catalogCourseItem).join("")}
      </ul>
    `;
  }

  return '<p class="search-status">Search by code or course name to add a course.</p>';
}

export function renderApp(
  root: HTMLElement,
  plan: StudyPlan,
  search: CourseSearchState,
  courseDestination: string,
  actions: AppActions,
): void {
  const warnings = validatePlan(plan);
  const duplicatedCodes = new Set(
    warnings.flatMap((warning) => warning.relatedCourseCodes ?? []),
  );
  const overloadedSemesters = new Set(
    warnings.flatMap((warning) => warning.relatedSemesterIds ?? []),
  );

  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <a class="brand" href="#" aria-label="PlanGrid home">
          <span class="brand__mark">PG</span>
          <span>PlanGrid</span>
        </a>
        <div class="header-actions">
          <span class="save-status">Saved locally</span>
          <button class="button button--ghost" id="export-png">Export PNG</button>
          <button class="button button--ghost" id="reset-plan">Reset plan</button>
        </div>
      </header>

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
                        duplicatedCodes,
                        "storage",
                        courseDestination !== STORAGE_DESTINATION,
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
            <label for="course-query">Course code or name</label>
            <div>
              <input
                id="course-query"
                name="query"
                type="search"
                value="${escapeHtml(search.query)}"
                placeholder="ISIS-1225 or estructuras"
                autocomplete="off"
                required
              />
              <button type="submit" ${search.status === "loading" ? "disabled" : ""}>
                ${search.status === "loading" ? "Searching" : "Search"}
              </button>
            </div>
          </form>
          <label class="field">
            <span>Add courses to</span>
            <select id="course-destination">
              ${plan.semesters
                .map(
                  (semester) =>
                    `<option value="${escapeHtml(semester.id)}" ${semester.id === courseDestination ? "selected" : ""}>${escapeHtml(semester.label)}</option>`,
                )
                .join("")}
              <option value="storage" ${courseDestination === "storage" ? "selected" : ""}>Storage</option>
            </select>
          </label>
          <p class="drag-hint">Drag any result directly into a semester or storage.</p>
          <div class="search-results" aria-live="polite">
            ${searchContent(search)}
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
              const hasDuplicate = semester.courses.some((course) =>
                duplicatedCodes.has(course.code),
              );
              const hasWarning = isOverloaded || hasDuplicate;
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
                                duplicatedCodes,
                                "semester",
                                true,
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

  root.querySelector<HTMLSelectElement>("#course-destination")?.addEventListener("change", (event) => {
    actions.setCourseDestination(
      (event.currentTarget as HTMLSelectElement).value,
    );
  });

  const availableCourses = new Map(
    [
      ...search.results,
      ...(search.status === "error" ? mockCourses : []),
    ].map((course) => [course.code, course]),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-add-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const course = availableCourses.get(button.dataset.addCourse ?? "");
      const destination =
        root.querySelector<HTMLSelectElement>("#course-destination")?.value;

      if (!course || !destination) return;

      actions.updatePlan((current) => addCourse(current, course, destination));
    });
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

  root.querySelectorAll<HTMLButtonElement>("[data-place-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.dataset.placeCourse;
      if (!courseId || courseDestination === STORAGE_DESTINATION) return;
      actions.updatePlan((current) =>
        moveCourse(current, courseId, courseDestination),
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

    const plannedCourse = [
      ...plan.semesters.flatMap((semester) => semester.courses),
      ...plan.storage,
    ].find((course) => course.id === payload.courseId);

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

  root.querySelector<HTMLButtonElement>("#export-png")?.addEventListener("click", () => {
      actions.exportPNG(mainClass);
  });

}
