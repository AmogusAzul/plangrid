import "./styles.css";
import {
  searchFastCourses,
  searchThoroughCatalogCourses,
} from "./api/enhancedCourseSearch";
import type { Course } from "./models/course";
import {
  initialCourseSearchState,
  type CourseSearchState,
} from "./models/courseSearch";
import { createBlankPlan } from "./state/planFactory";
import { loadPlan, savePlan, STORAGE_KEY } from "./state/planStorage";
import { renderApp } from "./ui/renderApp";
import { exportPlanPNG } from "./export/pngExport";
import {
  exportPlanFile,
  importPlanFile,
} from "./export/csvExport";
import {
  loadPlanPreset,
  planPresets,
} from "./presets/planPresets";
import {
  loadSearchAppearanceSettings,
  saveSearchAppearanceSettings,
} from "./state/searchAppearance";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("PlanGrid could not find the application root.");
}

const appRoot = root;
let plan = loadPlan();
let courseSearch: CourseSearchState = initialCourseSearchState;
let searchAppearance = loadSearchAppearanceSettings();
let selectedDetailsCourse: Course | null = null;
let activeSearch = 0;

function render(): void {
  renderApp(appRoot, plan, courseSearch, searchAppearance, selectedDetailsCourse, {
    updatePlan(update) {
      plan = savePlan(update(plan));
      render();
    },
    resetPlan() {
      localStorage.removeItem(STORAGE_KEY);
      plan = savePlan(createBlankPlan());
      selectedDetailsCourse = null;
      render();
    },
    exportPNG(planner: HTMLElement, planName: string) {
      return exportPlanPNG(planner, planName);
    },
    exportPlan() {
      exportPlanFile(plan);
    },
    async importPlan(file: File) {
      const imported = await importPlanFile(await file.text());
      plan = savePlan(imported.plan);
      render();
      return imported.fallbackCodes;
    },
    async loadPreset(presetId: string) {
      const preset = planPresets.find((entry) => entry.id === presetId);
      if (!preset) {
        throw new Error("The selected preset is unavailable.");
      }

      const loaded = await loadPlanPreset(preset);
      plan = savePlan(loaded.plan);
      render();
      return loaded.fallbackCodes;
    },
    updateSearchFilters(filters) {
      courseSearch = {
        ...courseSearch,
        filters,
      };
      render();
    },
    updateSearchAppearance(settings) {
      searchAppearance = saveSearchAppearanceSettings(settings);
      render();
    },
    showCourseDetails(course) {
      selectedDetailsCourse = course;
      render();
    },
    closeCourseDetails() {
      selectedDetailsCourse = null;
      render();
    },
    async search(query, mode = "fast") {
      const normalizedQuery = query.trim();
      const searchId = activeSearch + 1;
      activeSearch = searchId;
      courseSearch = {
        ...courseSearch,
        query: normalizedQuery,
        mode,
        status: mode === "catalog" ? "catalog-loading" : "loading",
        results: [],
        error: null,
      };
      render();

      try {
        const results = mode === "catalog"
          ? await searchThoroughCatalogCourses(
              normalizedQuery,
              courseSearch.filters,
            )
          : await searchFastCourses(normalizedQuery, courseSearch.filters);
        if (searchId !== activeSearch) return;

        courseSearch = {
          ...courseSearch,
          query: normalizedQuery,
          mode,
          status: "success",
          results,
          error: null,
        };
      } catch (error) {
        if (searchId !== activeSearch) return;

        courseSearch = {
          ...courseSearch,
          query: normalizedQuery,
          mode,
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
