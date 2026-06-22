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

  it("accepts same-semester prerequisites for 8-week target courses", () => {
    const plan = createBlankPlan(1);
    const target = course("target", "ESCR-1102", ["ESCR-1101"]);
    target.requirements!.partOfTerm = "8A";
    plan.semesters[0].courses.push(
      course("first", "ESCR-1101"),
      target,
    );

    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
    );

    target.requirements!.partOfTerm = "1";
    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "unmet",
    );
  });

  it("uses recognized precalculus aliases as fulfilled requirements", () => {
    const plan = createBlankPlan(1);
    plan.recognizedRequirementIds = ["homologated-precalculus"];
    plan.semesters[0].courses.push(
      course("target", "ISIS-1107", ["MATE-1"]),
    );

    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
    );
  });

  it("uses the recognized foreign-language requirement aliases", () => {
    const plan = createBlankPlan(1);
    plan.recognizedRequirementIds = ["foreign-language-requirement"];
    plan.semesters[0].courses.push(
      course("target", "ARQT-3214", ["ENGL-7"]),
    );

    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
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
