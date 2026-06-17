import MiniSearch from "minisearch";
import type { CatalogCourse } from "../models/catalogCourse";
import type { CourseSearchResult, SearchFilters } from "../models/searchResult";
import {
  catalogSummary,
  normalizeCourseCode,
  normalizeSearchText,
} from "./normalize";
import { getCatalogSnippet } from "./snippets";
import { expandSearchQuery } from "./searchSynonyms";
import { loadCatalogIndex } from "./catalogIndex";

type CatalogSearchDocument = CatalogCourse & {
  id: string;
};

let miniSearchPromise: Promise<{
  search: MiniSearch<CatalogSearchDocument>;
  courses: CatalogSearchDocument[];
}> | null = null;

function createMiniSearch(courses: CatalogCourse[]) {
  const documents = courses.map((course) => ({
    ...course,
    id: course.normalizedCode,
  }));
  const search = new MiniSearch<CatalogSearchDocument>({
    fields: ["code", "title", "departmentCode", "description", "searchableText"],
    storeFields: [
      "code",
      "normalizedCode",
      "title",
      "credits",
      "departmentCode",
      "departmentName",
      "description",
      "catalogUrl",
      "catalogYear",
      "source",
      "searchableText",
    ],
    searchOptions: {
      boost: {
        code: 8,
        title: 5,
        departmentCode: 2,
        description: 1,
        searchableText: 1,
      },
      prefix: true,
      fuzzy: 0.12,
    },
  });

  search.addAll(documents);
  return { search, courses: documents };
}

async function getMiniSearch(fetchApi?: typeof fetch) {
  miniSearchPromise ??= loadCatalogIndex(fetchApi).then((index) =>
    createMiniSearch(index.courses),
  );

  return miniSearchPromise;
}

function passesFilters(
  course: CatalogCourse,
  filters: SearchFilters,
): boolean {
  return (
    filters.department === "all" ||
    course.departmentCode === filters.department
  );
}

export async function searchCatalogCourses(
  query: string,
  filters: SearchFilters,
  limit = 50,
  fetchApi?: typeof fetch,
): Promise<CourseSearchResult[]> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const { search } = await getMiniSearch(fetchApi);
  const results = new Map<string, CourseSearchResult>();

  for (const expandedQuery of expandSearchQuery(query)) {
    for (const result of search.search(expandedQuery, { combineWith: "OR" })) {
      const course = result as unknown as CatalogCourse;
      if (!passesFilters(course, filters)) continue;

      const code = normalizeCourseCode(course.code);
      if (results.has(code)) continue;

      const snippet = getCatalogSnippet(course, query);
      results.set(code, {
        code,
        name: course.title,
        credits: course.credits ?? 3,
        department: course.departmentCode,
        source: "catalog",
        metadataSource: "catalog",
        availability: "unknown",
        metadataFallback: course.credits === null ? true : undefined,
        matchedSnippet: snippet,
        catalog: {
          ...catalogSummary(course),
          matchedSnippet: snippet,
        },
      });
    }
  }

  return [...results.values()].slice(0, limit);
}

export function resetCatalogSearchCache(): void {
  miniSearchPromise = null;
}
