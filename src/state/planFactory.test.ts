import { describe, expect, it } from "vitest";
import {
  cascadeSemesterTerms,
  createBlankPlan,
  nextRegularTerm,
  resizeSemesters,
  updateSemesterTerm,
} from "./planFactory";

describe("planFactory", () => {
  it("creates an eight-semester blank plan by default", () => {
    const plan = createBlankPlan();

    expect(plan.semesters).toHaveLength(8);
    expect(plan.semesters[0].termHint).toBe("2026-20");
    expect(plan.semesters[1].termHint).toBe("2027-10");
  });

  it("alternates regular terms", () => {
    expect(nextRegularTerm("2026-10")).toBe("2026-20");
    expect(nextRegularTerm("2026-20")).toBe("2027-10");
  });

  it("rejects summer and malformed terms", () => {
    expect(() => nextRegularTerm("2026-30")).toThrow("Invalid regular term");
    expect(() => nextRegularTerm("2026")).toThrow("Invalid regular term");
  });

  it("cascades a new first term through the plan", () => {
    const plan = createBlankPlan(4);

    const updated = cascadeSemesterTerms(plan, 0, "2025-10");

    expect(updated.semesters.map((semester) => semester.termHint)).toEqual([
      "2025-10",
      "2025-20",
      "2026-10",
      "2026-20",
    ]);
  });

  it("cascades from an edited semester without changing earlier terms", () => {
    const plan = createBlankPlan(4);
    const editedSemester = plan.semesters[2];

    const updated = updateSemesterTerm(plan, editedSemester.id, "2029-20");

    expect(updated.semesters.map((semester) => semester.termHint)).toEqual([
      "2026-20",
      "2027-10",
      "2029-20",
      "2030-10",
    ]);
  });

  it("moves courses from removed semesters into storage", () => {
    const plan = createBlankPlan(2);
    plan.semesters[1].courses.push({
      id: "course-1",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });

    const resized = resizeSemesters(plan, 1);

    expect(resized.semesters).toHaveLength(1);
    expect(resized.storage).toHaveLength(1);
  });

  it("preserves existing semesters and courses when increasing the count", () => {
    const plan = createBlankPlan(2);
    const existingIds = plan.semesters.map((semester) => semester.id);
    plan.semesters[1].courses.push({
      id: "course-1",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });

    const resized = resizeSemesters(plan, 4);

    expect(resized.semesters.slice(0, 2).map((semester) => semester.id)).toEqual(
      existingIds,
    );
    expect(resized.semesters[1].courses).toHaveLength(1);
    expect(resized.semesters.map((semester) => semester.termHint)).toEqual([
      "2026-20",
      "2027-10",
      "2027-20",
      "2028-10",
    ]);
  });
});
