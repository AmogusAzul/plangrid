import type { Course } from "../models/course";
import type {
  CourseSearchResult,
  SearchResultAvailability,
} from "../models/searchResult";
import { getCourseByCode } from "./courseApi";

export const CURRENT_OFFERING_TERM = "202620";
export const AVAILABILITY_CACHE_KEY =
  "plangrid.courseAvailability.202620.v1";
export const MAX_CATALOG_RESULTS_TO_VERIFY = 30;
export const AVAILABILITY_CONCURRENCY = 4;

export type CourseAvailabilityCacheEntry = {
  code: string;
  term: typeof CURRENT_OFFERING_TERM;
  status: SearchResultAvailability;
  checkedAt: string;
};

type CourseLookup = (code: string) => Promise<Course | null>;

function readCache(
  storage: Storage | undefined,
): Map<string, CourseAvailabilityCacheEntry> {
  if (!storage) return new Map();

  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(AVAILABILITY_CACHE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return new Map();

    return new Map(
      parsed
        .filter(
          (entry): entry is CourseAvailabilityCacheEntry =>
            entry &&
            typeof entry === "object" &&
            (entry as CourseAvailabilityCacheEntry).term ===
              CURRENT_OFFERING_TERM &&
            typeof (entry as CourseAvailabilityCacheEntry).code === "string",
        )
        .map((entry) => [entry.code, entry]),
    );
  } catch {
    return new Map();
  }
}

function writeCache(
  storage: Storage | undefined,
  cache: Map<string, CourseAvailabilityCacheEntry>,
): void {
  if (!storage) return;

  storage.setItem(
    AVAILABILITY_CACHE_KEY,
    JSON.stringify([...cache.values()].slice(-500)),
  );
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

export async function reconcileCatalogAvailability(
  results: CourseSearchResult[],
  lookup: CourseLookup = getCourseByCode,
  storage: Storage | undefined = globalThis.localStorage,
): Promise<CourseSearchResult[]> {
  const cache = readCache(storage);
  const candidates = results.slice(0, MAX_CATALOG_RESULTS_TO_VERIFY);

  await mapConcurrent(candidates, AVAILABILITY_CONCURRENCY, async (result) => {
    if (result.source === "api") return;

    const cached = cache.get(result.code);
    if (cached) {
      result.availability = cached.status;
      return;
    }

    try {
      const apiCourse = await lookup(result.code);
      const status: SearchResultAvailability = apiCourse
        ? "api-available"
        : "catalog-only";
      cache.set(result.code, {
        code: result.code,
        term: CURRENT_OFFERING_TERM,
        status,
        checkedAt: new Date().toISOString(),
      });

      if (apiCourse) {
        result.name = apiCourse.name;
        result.credits = apiCourse.credits;
        result.department = apiCourse.department ?? result.department;
        result.source = "api+catalog";
        result.metadataSource = "api+catalog";
      }
      result.availability = status;
    } catch {
      result.availability = "unknown";
      cache.set(result.code, {
        code: result.code,
        term: CURRENT_OFFERING_TERM,
        status: "unknown",
        checkedAt: new Date().toISOString(),
      });
    }
  });

  writeCache(storage, cache);
  return results;
}
