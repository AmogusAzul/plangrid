import type {
  CatalogCourse,
  CatalogCourseSummary,
} from "../models/catalogCourse";
import { loadCatalogIndex } from "./catalogIndex";
import { catalogSummary, normalizeCourseCode } from "./normalize";

export type CatalogDepartmentOption = {
  code: string;
  name?: string;
};

let departmentsPromise: Promise<CatalogDepartmentOption[]> | null = null;
let coursesByCodePromise: Promise<Map<string, CatalogCourse>> | null = null;

async function getCoursesByCode(): Promise<Map<string, CatalogCourse>> {
  coursesByCodePromise ??= loadCatalogIndex().then(
    (index) =>
      new Map(
        index.courses.map((course) => [
          normalizeCourseCode(course.code),
          course,
        ]),
      ),
  );

  return coursesByCodePromise;
}

export async function loadCatalogDepartments(): Promise<
  CatalogDepartmentOption[]
> {
  departmentsPromise ??= loadCatalogIndex().then((index) => {
    const departments = new Map<string, CatalogDepartmentOption>();

    for (const course of index.courses) {
      if (!departments.has(course.departmentCode)) {
        departments.set(course.departmentCode, {
          code: course.departmentCode,
          name: course.departmentName,
        });
      }
    }

    return [...departments.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    );
  });

  return departmentsPromise;
}

export async function getCatalogCourseSummaryByCode(
  code: string,
): Promise<CatalogCourseSummary | null> {
  const coursesByCode = await getCoursesByCode();
  const course = coursesByCode.get(normalizeCourseCode(code));

  return course ? catalogSummary(course) : null;
}

export async function getCatalogCourseSummaries(
  codes: string[],
): Promise<Map<string, CatalogCourseSummary>> {
  const coursesByCode = await getCoursesByCode();
  const summaries = new Map<string, CatalogCourseSummary>();

  for (const code of codes) {
    const normalizedCode = normalizeCourseCode(code);
    const course = coursesByCode.get(normalizedCode);
    if (course) {
      summaries.set(normalizedCode, catalogSummary(course));
    }
  }

  return summaries;
}

export async function loadCatalogCourseCodes(): Promise<Set<string>> {
  const coursesByCode = await getCoursesByCode();
  return new Set(coursesByCode.keys());
}
