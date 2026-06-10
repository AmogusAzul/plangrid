import type { PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import type { PlanWarning } from "../models/warning";

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
    if (courses.length > 1) {
      warnings.push({
        id: `duplicate-${code}`,
        severity: "warning",
        message: `${code} appears more than once in the plan.`,
        relatedCourseCodes: [code],
      });
    }
  }

  return warnings;
}

