import type { CourseSearchResult, SearchFilters } from "./searchResult";

export type CourseSearchState = {
  query: string;
  status: "idle" | "loading" | "catalog-loading" | "success" | "error";
  mode: "fast" | "catalog";
  results: CourseSearchResult[];
  filters: SearchFilters;
  error: string | null;
};

export const initialCourseSearchState: CourseSearchState = {
  query: "",
  status: "idle",
  mode: "fast",
  results: [],
  filters: {
    department: "all",
    source: "all",
  },
  error: null,
};
