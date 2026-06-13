import { describe, expect, it, vi } from "vitest";
import type { Course } from "../models/course";
import {
  loadPlanPreset,
  planPresets,
  type PlanPreset,
} from "./planPresets";

describe("plan presets", () => {
  it("ships blank and ISIS starter presets from repository JSON", () => {
    expect(planPresets.map((preset) => preset.id)).toEqual([
      "blank-8-semesters",
      "isis-2026-20-starter",
    ]);
    expect(planPresets[0].semesters).toHaveLength(8);
  });

  it("loads a blank preset without course API calls", async () => {
    const lookup = vi.fn();

    const loaded = await loadPlanPreset(planPresets[0], lookup);

    expect(lookup).not.toHaveBeenCalled();
    expect(loaded.plan.semesters).toHaveLength(8);
    expect(loaded.plan.semesters.every((semester) =>
      semester.courses.length === 0
    )).toBe(true);
  });

  it("fetches each unique code once and creates fresh course identities", async () => {
    const preset: PlanPreset = {
      id: "test",
      name: "Test preset",
      description: "Test",
      creditLimitPerSemester: 21,
      semesters: [
        {
          label: "Semester 1",
          termHint: "2026-20",
          courseCodes: ["ISIS-1221", "ISIS-1221"],
        },
      ],
      storageCourseCodes: ["ISIS-1221"],
    };
    const course: Course = {
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
      department: "ISIS",
    };
    const lookup = vi.fn(async () => course);

    const loaded = await loadPlanPreset(preset, lookup);
    const plannedCourses = [
      ...loaded.plan.semesters[0].courses,
      ...loaded.plan.storage,
    ];

    expect(lookup).toHaveBeenCalledOnce();
    expect(new Set(plannedCourses.map((entry) => entry.id)).size).toBe(3);
  });

  it("marks unavailable course metadata for persistent warnings", async () => {
    const preset: PlanPreset = {
      id: "fallback",
      name: "Fallback",
      description: "Test",
      creditLimitPerSemester: 21,
      semesters: [
        {
          label: "Semester 1",
          termHint: "2026-20",
          courseCodes: ["UNKNOWN-1000"],
        },
      ],
      storageCourseCodes: [],
    };

    const loaded = await loadPlanPreset(preset, async () => null);

    expect(loaded.fallbackCodes).toEqual(["UNKNOWN-1000"]);
    expect(loaded.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        credits: 3,
        metadataFallback: true,
      }),
    );
  });
});
