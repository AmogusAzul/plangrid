import type { CatalogCourseSummary } from "../models/catalogCourse";
import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { getCatalogCourseSummaries } from "../catalog/catalogMetadata";
import { normalizeCourseCode } from "../catalog/normalize";

function mergeCatalogSummary(
  course: PlannedCourse,
  summaries: Map<string, CatalogCourseSummary>,
): PlannedCourse {
  const summary = summaries.get(normalizeCourseCode(course.code));
  if (!summary) return course;

  return {
    ...course,
    catalog: {
      ...summary,
      ...course.catalog,
      description: course.catalog?.description ?? summary.description,
      catalogUrl: course.catalog?.catalogUrl ?? summary.catalogUrl,
      catalogYear: course.catalog?.catalogYear ?? summary.catalogYear,
    },
    metadataSource:
      course.metadataSource === "catalog" || course.metadataSource === "fallback"
        ? course.metadataSource
        : "api+catalog",
  };
}

export async function enrichPlanWithCatalogDescriptions(
  plan: StudyPlan,
): Promise<StudyPlan> {
  const codes = [
    ...plan.semesters.flatMap((semester) =>
      semester.courses.map((course) => course.code),
    ),
    ...plan.storage.map((course) => course.code),
  ];
  if (codes.length === 0) return plan;

  const summaries = await getCatalogCourseSummaries(codes);
  if (summaries.size === 0) return plan;

  return {
    ...plan,
    semesters: plan.semesters.map((semester) => ({
      ...semester,
      courses: semester.courses.map((course) =>
        mergeCatalogSummary(course, summaries),
      ),
    })),
    storage: plan.storage.map((course) =>
      mergeCatalogSummary(course, summaries),
    ),
  };
}
