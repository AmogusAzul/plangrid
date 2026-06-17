import type { Course } from "../models/course";
import type {
  CourseSearchResult,
  SearchFilters,
} from "../models/searchResult";
import { searchCatalogCourses } from "../catalog/catalogSearch";
import { reconcileCatalogAvailability } from "./courseAvailability";
import { searchCourses } from "./courseApi";

export type EnhancedSearchMode = "fast" | "catalog";

export function toApiSearchResult(course: Course): CourseSearchResult {
  return {
    ...course,
    source: "api",
    metadataSource: course.metadataSource ?? "api",
    availability: "api-available",
  };
}

function passesFilters(
  result: CourseSearchResult,
  filters: SearchFilters,
): boolean {
  return (
    (filters.department === "all" || result.department === filters.department) &&
    (filters.source === "all" || result.availability === filters.source)
  );
}

export async function searchFastCourses(
  query: string,
  filters: SearchFilters,
): Promise<CourseSearchResult[]> {
  const results = (await searchCourses(query)).map(toApiSearchResult);
  return results.filter((result) => passesFilters(result, filters));
}

export async function searchThoroughCatalogCourses(
  query: string,
  filters: SearchFilters,
): Promise<CourseSearchResult[]> {
  const catalogResults = await searchCatalogCourses(query, filters);
  const reconciled = await reconcileCatalogAvailability(catalogResults);
  return reconciled.filter((result) => passesFilters(result, filters));
}
