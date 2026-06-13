import { getCourseByCode } from "../api/courseApi";
import type { Course, PlannedCourse } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { createId, isRegularTerm } from "../state/planFactory";
import blankPresetData from "./blank-8-semesters.json";
import isisPresetData from "./isis-2026-20-starter.json";

type CourseLookup = (code: string) => Promise<Course | null>;

export type PlanPreset = {
  id: string;
  name: string;
  description: string;
  creditLimitPerSemester: number;
  semesters: Array<{
    label: string;
    termHint: string;
    courseCodes: string[];
  }>;
  storageCourseCodes: string[];
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

function fallbackCourse(code: string): Course {
  return {
    code,
    name: `Unknown course (${code})`,
    credits: 3,
    department: code.split("-", 1)[0] || undefined,
  };
}

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
  const resolved = new Map<string, Course>();
  const fallbackCodes: string[] = [];

  await Promise.all(
    uniqueCodes.map(async (code) => {
      let course: Course | null = null;

      try {
        course = await lookup(code);
      } catch {
        course = null;
      }

      if (!course) {
        fallbackCodes.push(code);
        course = fallbackCourse(code);
      }

      resolved.set(code, course);
    }),
  );

  const fallbackSet = new Set(fallbackCodes);
  const now = new Date().toISOString();
  const courseFor = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    return toPlannedCourse(
      resolved.get(normalizedCode)!,
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
    },
    fallbackCodes: fallbackCodes.sort(),
  };
}
