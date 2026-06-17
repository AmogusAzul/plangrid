import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import type { PlanWarning } from "../models/warning";
import { isRequirementCourseCode } from "../presets/mockCourses";

export function sumCredits(courses: PlannedCourse[]): number {
  return courses.reduce((total, course) => total + course.credits, 0);
}

export function getTotalPlanCredits(plan: StudyPlan): number {
  return sumCredits([
    ...plan.semesters.flatMap((semester) => semester.courses),
    ...plan.storage,
  ]);
}

export function validatePlan(plan: StudyPlan): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const coursesByCode = new Map<string, PlannedCourse[]>();

  for (const semester of plan.semesters) {
    const credits = sumCredits(semester.courses);

    if (credits > plan.creditLimitPerSemester) {
      warnings.push({
        id: `overload-${semester.id}`,
        severity: "warning",
        message: `${semester.label} has ${credits} credits, above the configured limit of ${plan.creditLimitPerSemester}.`,
        relatedSemesterIds: [semester.id],
      });
    }

    for (const course of semester.courses) {
      const entries = coursesByCode.get(course.code) ?? [];
      entries.push(course);
      coursesByCode.set(course.code, entries);
    }
  }

  for (const course of plan.storage) {
    const entries = coursesByCode.get(course.code) ?? [];
    entries.push(course);
    coursesByCode.set(course.code, entries);
  }

  for (const [code, courses] of coursesByCode) {
    if (courses.length > 1 && !isRequirementCourseCode(code)) {
      warnings.push({
        id: `duplicate-${code}`,
        severity: "warning",
        message: `${code} appears more than once in the plan.`,
        relatedCourseCodes: [code],
      });
    }

    if (courses.some((course) => course.metadataFallback)) {
      warnings.push({
        id: `metadata-fallback-${code}`,
        severity: "warning",
        message: `Could not fetch metadata for ${code}. Using fallback credits.`,
        relatedCourseCodes: [code],
      });
    }
  }

  const unknownAvailabilityCourses = [...coursesByCode.values()]
    .flat()
    .filter((course) => course.availability === "unknown");
  if (unknownAvailabilityCourses.length > 0) {
    warnings.push({
      id: "unknown-availability-courses",
      severity: "warning",
      message: `Could not verify availability for ${unknownAvailabilityCourses.length} catalog course${unknownAvailabilityCourses.length === 1 ? "" : "s"}. Catalog metadata was used.`,
      relatedCourseCodes: [
        ...new Set(unknownAvailabilityCourses.map((course) => course.code)),
      ],
    });
  }

  return warnings;
}
