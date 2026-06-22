import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import { createBlankPlan } from "../state/planFactory";
import { evaluatePlannedCourseRequirements } from "./evaluateCourseRequirements";

function course(
  id: string,
  code: string,
  prerequisites: string[] = [],
  corequisites: string[] = [],
): PlannedCourse {
  return {
    id,
    code,
    name: code,
    credits: 3,
    requirements: {
      status: "loaded",
      term: "202620",
      checkedAt: "2026-06-22T00:00:00.000Z",
      prerequisites: prerequisites.map((required) => ({
        codeExpression: required,
        descriptionExpression: required,
        expression: { type: "course", code: required },
      })),
      corequisites: corequisites.map((required) => ({
        code: required,
        title: required,
      })),
    },
  };
}

describe("course requirement evaluation", () => {
  it("accepts prerequisites only in earlier semesters", () => {
    const plan = createBlankPlan(2);
    plan.semesters[0].courses.push(course("pre", "ISIS-1221"));
    plan.semesters[1].courses.push(
      course("target", "ISIS-1225", ["ISIS-1221"]),
    );
    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
    );

    plan.semesters[0].courses = [];
    plan.semesters[1].courses.push(course("same", "ISIS-1221"));
    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "unmet",
    );
  });

  it("requires corequisites in the exact same semester", () => {
    const plan = createBlankPlan(2);
    plan.semesters[0].courses.push(course("lab", "FISI-1518P"));
    plan.semesters[1].courses.push(
      course("physics", "FISI-1518", [], ["FISI-1518P"]),
    );
    expect(evaluatePlannedCourseRequirements(plan, "physics").status).toBe(
      "unmet",
    );

    plan.semesters[1].courses.push(course("same-lab", "FISI-1518P"));
    expect(evaluatePlannedCourseRequirements(plan, "physics").status).toBe(
      "satisfied",
    );
  });

  it("does not evaluate storage courses", () => {
    const plan = createBlankPlan(1);
    plan.storage.push(course("stored", "ISIS-1225", ["ISIS-1221"]));
    expect(evaluatePlannedCourseRequirements(plan, "stored").status).toBe(
      "unavailable",
    );
  });
});
