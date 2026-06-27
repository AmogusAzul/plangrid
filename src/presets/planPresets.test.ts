import { describe, expect, it, vi } from "vitest";
import type { Course } from "../models/course";
import type { StudyPlan } from "../models/studyPlan";
import { serializePlanFile } from "../export/csvExport";
import { createBlankPlan } from "../state/planFactory";
import {
  loadPlanPreset,
  planPresets,
  type PlanPreset,
} from "./planPresets";

function presetFor(plan: StudyPlan, filename: string): PlanPreset {
  const source = serializePlanFile(plan);
  const courseCount =
    plan.semesters.reduce(
      (total, semester) => total + semester.courses.length,
      0,
    ) + plan.storage.length;

  return {
    id: filename,
    filename,
    name: plan.name,
    semesterCount: plan.semesters.length,
    courseCount,
    source,
  };
}

describe("plan presets", () => {
  it("discovers repository .plan files and reads their internal names", () => {
    expect(planPresets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filename: "blank-8-semesters.plan",
          name: "Blank 8-semester plan",
          semesterCount: 8,
        }),
        expect.objectContaining({
          filename: "isis-2026-10-precalculo-2026-06-26.plan",
          name: "ISIS 2026-10 Precalculo",
          semesterCount: 8,
        }),
      ]),
    );
    expect(
      planPresets.every((preset) => preset.filename.endsWith(".plan")),
    ).toBe(true);
  });

  it("loads a blank preset without course API calls", async () => {
    const lookup = vi.fn();

    const loaded = await loadPlanPreset(planPresets[0], lookup);

    expect(lookup).not.toHaveBeenCalled();
    expect(loaded.plan.filename).toBe("blank-8-semesters.plan");
    expect(loaded.plan.semesters).toHaveLength(8);
    expect(loaded.plan.semesters.every((semester) =>
      semester.courses.length === 0
    )).toBe(true);
  });

  it("fetches each unique code once and creates fresh course identities", async () => {
    const course: Course = {
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
      department: "ISIS",
    };
    const plan = createBlankPlan(1);
    plan.name = "Test preset";
    plan.semesters[0].courses.push(
      { ...course, id: "first", slotStart: 1 },
      { ...course, id: "second", slotStart: 4 },
    );
    plan.storage.push({ ...course, id: "stored" });
    const preset = presetFor(plan, "test.plan");
    const lookup = vi.fn(async () => course);

    const loaded = await loadPlanPreset(preset, lookup);
    const plannedCourses = [
      ...loaded.plan.semesters[0].courses,
      ...loaded.plan.storage,
    ];

    expect(lookup).toHaveBeenCalledOnce();
    expect(new Set(plannedCourses.map((entry) => entry.id)).size).toBe(3);
  });

  it("uses embedded plan metadata when the API fails", async () => {
    const preset = planPresets[1];
    const loaded = await loadPlanPreset(preset, async () => {
      throw new Error("offline");
    });

    expect(loaded.fallbackCodes).toEqual([]);
    expect(loaded.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        code: "ISIS-1001",
        name: "INTRODUCCION A LA INGENIERIA DE SISTEMAS",
        credits: 3,
      }),
    );
  });

  it("creates a fresh plan identity each time a preset is loaded", async () => {
    const first = await loadPlanPreset(planPresets[0], vi.fn());
    const second = await loadPlanPreset(planPresets[0], vi.fn());

    expect(first.plan.id).not.toBe(second.plan.id);
    expect(first.plan.name).toBe(planPresets[0].name);
  });
});
