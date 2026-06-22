import type { StudyPlan } from "../models/studyPlan";
import { createBlankPlan } from "./planFactory";
import { normalizeSemesterCourses } from "./semesterLayout";

export const STORAGE_KEY = "plangrid.currentPlan.v1";

function isStudyPlan(value: unknown): value is StudyPlan {
  if (!value || typeof value !== "object") return false;

  const plan = value as Partial<StudyPlan>;
  return (
    typeof plan.id === "string" &&
    typeof plan.name === "string" &&
    typeof plan.creditLimitPerSemester === "number" &&
    Array.isArray(plan.semesters) &&
    Array.isArray(plan.storage)
  );
}

export function loadPlan(storage: Storage = localStorage): StudyPlan {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return createBlankPlan();

    const parsed: unknown = JSON.parse(stored);
    if (!isStudyPlan(parsed)) return createBlankPlan();

    return {
      ...parsed,
      recognizedRequirementIds: Array.isArray(parsed.recognizedRequirementIds)
        ? parsed.recognizedRequirementIds
        : [],
      semesters: parsed.semesters.map((semester) => ({
        ...semester,
        courses: normalizeSemesterCourses(semester.courses),
      })),
    };
  } catch {
    return createBlankPlan();
  }
}

export function savePlan(
  plan: StudyPlan,
  storage: Storage = localStorage,
): StudyPlan {
  const savedPlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };

  storage.setItem(STORAGE_KEY, JSON.stringify(savedPlan));
  return savedPlan;
}
