import { describe, expect, it } from "vitest";
import { createBlankPlan } from "../state/planFactory";
import { getTotalPlanCredits, validatePlan } from "./validatePlan";

describe("validatePlan", () => {
  it("warns about duplicate courses across semesters and storage", () => {
    const plan = createBlankPlan(1);
    const course = {
      id: "one",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    };
    plan.semesters[0].courses.push(course);
    plan.storage.push({ ...course, id: "two" });

    expect(validatePlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "duplicate-ISIS-1221" }),
      ]),
    );
  });

  it("warns when a semester exceeds its credit limit", () => {
    const plan = createBlankPlan(1);
    plan.creditLimitPerSemester = 2;
    plan.semesters[0].courses.push({
      id: "one",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });

    expect(validatePlan(plan)[0].id).toBe(`overload-${plan.semesters[0].id}`);
  });

  it("includes storage in total plan credits", () => {
    const plan = createBlankPlan(1);
    plan.storage.push({
      id: "one",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });

    expect(getTotalPlanCredits(plan)).toBe(3);
  });
});

