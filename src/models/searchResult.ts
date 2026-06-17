import type { CatalogCourseSummary } from "./catalogCourse";
import type { Course, CourseMetadataSource } from "./course";

export type SearchResultAvailability =
  | "api-available"
  | "catalog-only"
  | "unknown";

export type SearchResultSource = "api" | "catalog" | "api+catalog";

export type CourseSearchResult = Course & {
  source: SearchResultSource;
  metadataSource: CourseMetadataSource;
  availability: SearchResultAvailability;
  catalog?: CatalogCourseSummary;
  matchedSnippet?: string;
};

export type SearchFilters = {
  department: string;
  source: "all" | SearchResultAvailability;
};
