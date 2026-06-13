import "./styles.css";
import { searchCourses } from "./api/courseApi";
import {
  initialCourseSearchState,
  type CourseSearchState,
} from "./models/courseSearch";
import { createBlankPlan } from "./state/planFactory";
import { loadPlan, savePlan, STORAGE_KEY } from "./state/planStorage";
import { renderApp } from "./ui/renderApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PlanGrid could not find the application root.");
}

const appRoot = root;
let plan = loadPlan();
let courseSearch: CourseSearchState = initialCourseSearchState;
let activeSearch = 0;

function render(): void {
  renderApp(appRoot, plan, courseSearch, {
    updatePlan(update) {
      plan = savePlan(update(plan));
      render();
    },
    resetPlan() {
      localStorage.removeItem(STORAGE_KEY);
      plan = savePlan(createBlankPlan());
      render();
    },
    async search(query) {
      const normalizedQuery = query.trim();
      const searchId = activeSearch + 1;
      activeSearch = searchId;
      courseSearch = {
        query: normalizedQuery,
        status: "loading",
        results: [],
        error: null,
      };
      render();

      try {
        const results = await searchCourses(normalizedQuery);
        if (searchId !== activeSearch) return;

        courseSearch = {
          query: normalizedQuery,
          status: "success",
          results,
          error: null,
        };
      } catch (error) {
        if (searchId !== activeSearch) return;

        courseSearch = {
          query: normalizedQuery,
          status: "error",
          results: [],
          error:
            error instanceof Error
              ? error.message
              : "Course search failed unexpectedly.",
        };
      }

      render();
    },
  });
}

render();
