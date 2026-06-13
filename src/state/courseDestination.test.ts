import { describe, expect, it } from "vitest";
import { createBlankPlan } from "./planFactory";
import {
  getDefaultCourseDestination,
  normalizeCourseDestination,
  STORAGE_DESTINATION,
} from "./courseDestination";

describe("courseDestination", () => {
  it("uses the first semester by default", () => {
    const plan = createBlankPlan(2);

    expect(getDefaultCourseDestination(plan)).toBe(plan.semesters[0].id);
  });

  it("preserves valid semester and storage destinations", () => {
    const plan = createBlankPlan(2);

    expect(
      normalizeCourseDestination(plan, plan.semesters[1].id),
    ).toBe(plan.semesters[1].id);
    expect(normalizeCourseDestination(plan, STORAGE_DESTINATION)).toBe(
      STORAGE_DESTINATION,
    );
  });

  it("falls back when the selected semester no longer exists", () => {
    const plan = createBlankPlan(1);

    expect(normalizeCourseDestination(plan, "removed-semester")).toBe(
      plan.semesters[0].id,
    );
  });
});

