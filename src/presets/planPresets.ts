import { getCourseByCode } from "../api/courseApi";
import {
  importPlanFile,
  parsePlanFile,
  type ImportedPlan,
} from "../export/csvExport";
import { createId } from "../state/planFactory";
import type { CourseLookup } from "../state/courseHydration";

export type PlanPreset = {
  id: string;
  filename: string;
  name: string;
  semesterCount: number;
  courseCount: number;
  source: string;
};

const presetSources = import.meta.glob("./*.plan", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function presetFromFile(path: string, source: string): PlanPreset {
  const filename = path.split("/").at(-1);
  if (!filename) {
    throw new Error(`Preset path has no filename: ${path}`);
  }

  const parsed = parsePlanFile(source);
  return {
    id: filename,
    filename,
    name: parsed.name,
    semesterCount: parsed.semesters.length,
    courseCount:
      parsed.semesters.reduce(
        (total, semester) => total + semester.courses.length,
        0,
      ) + parsed.storageCourses.length,
    source,
  };
}

export const planPresets = Object.entries(presetSources)
  .map(([path, source]) => presetFromFile(path, source))
  .sort((left, right) => left.filename.localeCompare(right.filename));

export async function loadPlanPreset(
  preset: PlanPreset,
  lookup: CourseLookup = getCourseByCode,
): Promise<ImportedPlan> {
  const loaded = await importPlanFile(preset.source, lookup, preset.filename);
  const now = new Date().toISOString();

  return {
    ...loaded,
    plan: {
      ...loaded.plan,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    },
  };
}
