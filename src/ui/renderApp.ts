import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { mockCourses } from "../presets/mockCourses";
import {
  resizeSemesters,
  toPlannedCourse,
} from "../state/planFactory";
import { getTotalPlanCredits, sumCredits, validatePlan } from "../validation/validatePlan";
import { getCourseColor } from "./courseColor";

type AppActions = {
  updatePlan: (update: (plan: StudyPlan) => StudyPlan) => void;
  resetPlan: () => void;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function courseCard(course: PlannedCourse, duplicatedCodes: Set<string>): string {
  const duplicateBadge = duplicatedCodes.has(course.code)
    ? '<span class="course-card__warning" title="Duplicate course">!</span>'
    : "";

  return `
    <article
      class="course-card"
      style="--course-span: ${Math.max(1, course.credits)}; --course-color: ${getCourseColor(course)}"
      data-course-id="${escapeHtml(course.id)}"
    >
      ${duplicateBadge}
      <strong>${escapeHtml(course.code)}</strong>
      <span>${escapeHtml(course.name)}</span>
      <small>${course.credits} cr</small>
      <button class="course-card__remove" data-remove-course="${escapeHtml(course.id)}" title="Remove course">Remove</button>
    </article>
  `;
}

function mockCourseButton(course: Course): string {
  return `
    <li class="catalog-course">
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

function findAndRemoveCourse(plan: StudyPlan, courseId: string): StudyPlan {
  return {
    ...plan,
    semesters: plan.semesters.map((semester) => ({
      ...semester,
      courses: semester.courses.filter((course) => course.id !== courseId),
    })),
    storage: plan.storage.filter((course) => course.id !== courseId),
  };
}

export function renderApp(
  root: HTMLElement,
  plan: StudyPlan,
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
        <div class="plan-title">
          <label for="plan-name">Plan name</label>
          <input id="plan-name" value="${escapeHtml(plan.name)}" />
        </div>
        <div class="header-actions">
          <span class="save-status">Saved locally</span>
          <button class="button button--ghost" id="reset-plan">Reset plan</button>
        </div>
      </header>

      <aside class="sidebar">
        <section class="panel">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Development catalog</span>
              <h2>Mock courses</h2>
            </div>
          </div>
          <label class="field">
            <span>Add courses to</span>
            <select id="course-destination">
              ${plan.semesters
                .map(
                  (semester) =>
                    `<option value="${escapeHtml(semester.id)}">${escapeHtml(semester.label)}</option>`,
                )
                .join("")}
              <option value="storage">Storage</option>
            </select>
          </label>
          <ul class="catalog-list">
            ${mockCourses.map(mockCourseButton).join("")}
          </ul>
        </section>

        <section class="panel storage-panel">
          <div class="panel__heading">
            <div>
              <span class="eyebrow">Unplaced</span>
              <h2>Storage</h2>
            </div>
            <span class="count-badge">${plan.storage.length}</span>
          </div>
          <div class="storage-track">
            ${
              plan.storage.length > 0
                ? plan.storage
                    .map((course) => courseCard(course, duplicatedCodes))
                    .join("")
                : '<p class="empty-state">Courses removed from shortened plans land here.</p>'
            }
          </div>
        </section>

        <section class="panel warnings-panel">
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
                      `<li><span>!</span>${escapeHtml(warning.message)}</li>`,
                  )
                  .join("")}</ul>`
              : '<p class="empty-state empty-state--success">No plan warnings.</p>'
          }
        </section>
      </aside>

      <main class="planner">
        <section class="planner-toolbar">
          <div>
            <span class="eyebrow">Academic roadmap</span>
            <h1>${escapeHtml(plan.name)}</h1>
          </div>
          <div class="plan-stats">
            <div><strong>${getTotalPlanCredits(plan)}</strong><span>Total credits</span></div>
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
            .map((semester) => {
              const credits = sumCredits(semester.courses);
              const isOverloaded = overloadedSemesters.has(semester.id);

              return `
                <article class="semester-row ${isOverloaded ? "semester-row--warning" : ""}">
                  <header class="semester-meta">
                    <span>${escapeHtml(semester.termHint)}</span>
                    <h2>${escapeHtml(semester.label)}</h2>
                    <strong>${credits} / ${plan.creditLimitPerSemester} credits${isOverloaded ? " !" : ""}</strong>
                  </header>
                  <div class="semester-track">
                    ${
                      semester.courses.length > 0
                        ? semester.courses
                            .map((course) => courseCard(course, duplicatedCodes))
                            .join("")
                        : '<p class="semester-empty">Add a course from the catalog</p>'
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

  root.querySelectorAll<HTMLButtonElement>("[data-add-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const course = mockCourses.find(
        (entry) => entry.code === button.dataset.addCourse,
      );
      const destination =
        root.querySelector<HTMLSelectElement>("#course-destination")?.value;

      if (!course || !destination) return;

      actions.updatePlan((current) => {
        const plannedCourse = toPlannedCourse(course);

        if (destination === "storage") {
          return { ...current, storage: [...current.storage, plannedCourse] };
        }

        return {
          ...current,
          semesters: current.semesters.map((semester) =>
            semester.id === destination
              ? { ...semester, courses: [...semester.courses, plannedCourse] }
              : semester,
          ),
        };
      });
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-remove-course]").forEach((button) => {
    button.addEventListener("click", () => {
      const courseId = button.dataset.removeCourse;
      if (!courseId) return;
      actions.updatePlan((current) => findAndRemoveCourse(current, courseId));
    });
  });

  root.querySelector<HTMLButtonElement>("#reset-plan")?.addEventListener("click", () => {
    if (window.confirm("Reset the current plan and remove the local autosave?")) {
      actions.resetPlan();
    }
  });
}

