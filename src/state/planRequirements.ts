import { fetchCourseRequirements } from "../api/courseRequirementsApi";
import { loadCatalogCourseCodes } from "../catalog/catalogMetadata";
import { normalizeCourseCode } from "../catalog/normalize";
import type { CourseRequirementCheck } from "../models/courseRequirement";
import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import {
  parsePrerequisiteExpression,
  resolveRequirementExpression,
} from "../requirements/prerequisiteParser";

export const COURSE_REQUIREMENTS_CACHE_KEY =
  "plangrid.courseRequirements.202620.v2";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIREMENTS_CONCURRENCY = 4;

type RequirementCache = Record<string, CourseRequirementCheck>;

function readCache(storage: Storage = localStorage): RequirementCache {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(COURSE_REQUIREMENTS_CACHE_KEY) ?? "{}",
    );
    return parsed && typeof parsed === "object"
      ? parsed as RequirementCache
      : {};
  } catch {
    return {};
  }
}

function writeCache(
  cache: RequirementCache,
  storage: Storage = localStorage,
): void {
  storage.setItem(COURSE_REQUIREMENTS_CACHE_KEY, JSON.stringify(cache));
}

function mergeRequirements(
  course: PlannedCourse,
  checks: Readonly<Record<string, CourseRequirementCheck>>,
): PlannedCourse {
  const requirements = checks[normalizeCourseCode(course.code)];
  return requirements ? { ...course, requirements } : course;
}

function mapPlanRequirements(
  plan: StudyPlan,
  checks: Readonly<Record<string, CourseRequirementCheck>>,
): StudyPlan {
  return {
    ...plan,
    semesters: plan.semesters.map((semester) => ({
      ...semester,
      courses: semester.courses.map((course) =>
        mergeRequirements(course, checks),
      ),
    })),
    storage: plan.storage.map((course) => mergeRequirements(course, checks)),
  };
}

export function applyCachedRequirements(
  plan: StudyPlan,
  storage: Storage = localStorage,
): StudyPlan {
  return mapPlanRequirements(plan, readCache(storage));
}

function isFresh(check: CourseRequirementCheck, now: number): boolean {
  const checkedAt = Date.parse(check.checkedAt);
  return Number.isFinite(checkedAt) && now - checkedAt < CACHE_MAX_AGE_MS;
}

function normalizeCheck(
  check: CourseRequirementCheck,
  catalogCodes: ReadonlySet<string>,
): CourseRequirementCheck {
  return {
    ...check,
    prerequisites: check.prerequisites.map((rule) => {
      const parsed = parsePrerequisiteExpression(rule.codeExpression);
      return {
        ...rule,
        expression: parsed
          ? resolveRequirementExpression(parsed, catalogCodes) ?? undefined
          : undefined,
      };
    }),
    corequisites: check.corequisites.filter((corequisite) =>
      catalogCodes.has(normalizeCourseCode(corequisite.code)),
    ),
  };
}

async function mapConcurrent<T>(
  items: T[],
  task: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await task(items[index]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(REQUIREMENTS_CONCURRENCY, items.length) },
      worker,
    ),
  );
}

export async function refreshPlanRequirements(
  plan: StudyPlan,
  storage: Storage = localStorage,
  lookup = fetchCourseRequirements,
  catalogCodesOverride?: ReadonlySet<string>,
): Promise<StudyPlan> {
  const cache = readCache(storage);
  const catalogCodes =
    catalogCodesOverride ?? await loadCatalogCourseCodes();
  const now = Date.now();
  const codes = [
    ...new Set(
      [
        ...plan.semesters.flatMap((semester) =>
          semester.courses.map((course) => course.code),
        ),
        ...plan.storage.map((course) => course.code),
      ].map(normalizeCourseCode),
    ),
  ].filter((code) => catalogCodes.has(code));
  const codesToRefresh = codes.filter(
    (code) => !cache[code] || !isFresh(cache[code], now),
  );
  let cacheChanged = false;

  await mapConcurrent(codesToRefresh, async (code) => {
    try {
      cache[code] = normalizeCheck(await lookup(code), catalogCodes);
      cacheChanged = true;
    } catch {
      // Transient failures do not replace a usable cached check.
    }
  });

  if (cacheChanged) writeCache(cache, storage);
  return mapPlanRequirements(plan, cache);
}
