import type { StudyPlan } from "../models/studyPlan";

export const STORAGE_DESTINATION = "storage";

export function getDefaultCourseDestination(plan: StudyPlan): string {
  return plan.semesters[0]?.id ?? STORAGE_DESTINATION;
}

export function normalizeCourseDestination(
  plan: StudyPlan,
  destination: string,
): string {
  if (
    destination === STORAGE_DESTINATION ||
    plan.semesters.some((semester) => semester.id === destination)
  ) {
    return destination;
  }

  return getDefaultCourseDestination(plan);
}

