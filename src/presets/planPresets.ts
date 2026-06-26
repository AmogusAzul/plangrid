import { getCourseByCode } from "../api/courseApi";
import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { createId, isRegularTerm } from "../state/planFactory";
import {
  hydrateCourses,
  type CourseLookup,
} from "../state/courseHydration";
import blankPresetData from "./blank-8-semesters.json";
import isisPresetData from "./isis-2026-20-starter.json";
import type { RecognizedRequirementId } from "../models/recognizedRequirement";
import { defaultColorOverrideSchemeIds } from "../ui/courseColor";

export type PlanPreset = {
  id: string;
  name: string;
  description: string;
  creditLimitPerSemester: number;
  courses: Course[];
  semesters: Array<{
    label: string;
    termHint: string;
    courseCodes: string[];
  }>;
  storageCourseCodes: string[];
  recognizedRequirementIds?: RecognizedRequirementId[];
};

export type LoadedPreset = {
  plan: StudyPlan;
  fallbackCodes: string[];
};

function validatePreset(value: unknown): PlanPreset {
  if (!value || typeof value !== "object") {
    throw new Error("Preset data must be an object.");
  }

  const preset = value as Partial<PlanPreset>;
  const validSemesters =
    Array.isArray(preset.semesters) &&
    preset.semesters.length >= 1 &&
    preset.semesters.length <= 16 &&
    preset.semesters.every(
      (semester) =>
        typeof semester?.label === "string" &&
        typeof semester.termHint === "string" &&
        isRegularTerm(semester.termHint) &&
        Array.isArray(semester.courseCodes) &&
        semester.courseCodes.every((code) => typeof code === "string"),
    );

  if (
    typeof preset.id !== "string" ||
    typeof preset.name !== "string" ||
    typeof preset.description !== "string" ||
    !Number.isInteger(preset.creditLimitPerSemester) ||
    preset.creditLimitPerSemester! < 1 ||
    preset.creditLimitPerSemester! > 30 ||
    !Array.isArray(preset.courses) ||
    !preset.courses.every(
      (course) =>
        typeof course?.code === "string" &&
        typeof course.name === "string" &&
        typeof course.credits === "number" &&
        Number.isFinite(course.credits) &&
        course.credits >= 0 &&
        (course.department === undefined ||
          typeof course.department === "string"),
    ) ||
    !validSemesters ||
    !Array.isArray(preset.storageCourseCodes) ||
    !preset.storageCourseCodes.every((code) => typeof code === "string")
  ) {
    throw new Error("Preset data is invalid.");
  }

  return preset as PlanPreset;
}

export const planPresets: PlanPreset[] = [
  validatePreset(blankPresetData),
  validatePreset(isisPresetData),
];

function toPlannedCourse(
  course: Course,
  fallback: boolean,
): PlannedCourse {
  return {
    ...course,
    id: createId(),
    ...(fallback ? { metadataFallback: true } : {}),
  };
}

export async function loadPlanPreset(
  preset: PlanPreset,
  lookup: CourseLookup = getCourseByCode,
): Promise<LoadedPreset> {
  const codes = [
    ...preset.semesters.flatMap((semester) => semester.courseCodes),
    ...preset.storageCourseCodes,
  ].map((code) => code.trim().toUpperCase());
  const uniqueCodes = [...new Set(codes)];
  const hydrated = await hydrateCourses(
    uniqueCodes,
    preset.courses,
    lookup,
  );

  const fallbackSet = new Set(hydrated.fallbackCodes);
  const now = new Date().toISOString();
  const courseFor = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    return toPlannedCourse(
      hydrated.courses.get(normalizedCode)!,
      fallbackSet.has(normalizedCode),
    );
  };

  return {
    plan: {
      id: createId(),
      name: preset.name,
      createdAt: now,
      updatedAt: now,
      creditLimitPerSemester: preset.creditLimitPerSemester,
      semesters: preset.semesters.map((semester) => ({
        id: createId(),
        label: semester.label,
        termHint: semester.termHint,
        courses: semester.courseCodes.map(courseFor),
      })),
      storage: preset.storageCourseCodes.map(courseFor),
      recognizedRequirementIds: preset.recognizedRequirementIds ?? [],
      colorOverrideSchemeIds: defaultColorOverrideSchemeIds,
    },
    fallbackCodes: hydrated.fallbackCodes,
  };
}
