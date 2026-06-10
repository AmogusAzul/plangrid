import { describe, expect, it } from "vitest";
import {
  createBlankPlan,
  nextRegularTerm,
  resizeSemesters,
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
});

