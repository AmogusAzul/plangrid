import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import { createBlankPlan } from "../state/planFactory";
import { evaluatePlannedCourseRequirements } from "./evaluateCourseRequirements";
import { parsePrerequisiteExpression } from "./prerequisiteParser";

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
        expression: {
          type: "course",
          code: required,
          concurrent: false,
        },
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

  it("accepts starred prerequisites in the same semester for full-term targets", () => {
    const plan = createBlankPlan(1);
    const target = course("target", "MATE-1203", ["MATE-1201"]);
    target.requirements!.partOfTerm = "1";
    target.requirements!.prerequisites[0].expression = {
      type: "course",
      code: "MATE-1201",
      concurrent: true,
    };
    plan.semesters[0].courses.push(
      course("precalculus", "MATE-1201"),
      target,
    );

    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
    );

    target.requirements!.prerequisites[0].expression = {
      type: "course",
      code: "MATE-1201",
      concurrent: false,
    };
    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "unmet",
    );
  });

  it("returns only unsatisfied AND branches and clears a satisfied OR group", () => {
    const plan = createBlankPlan(2);
    const target = course("target", "ISIS-3311");
    target.requirements!.prerequisites = [
      {
        codeExpression:
          "(ISIS 3204 O ISIS 2311) Y (ISIS 2503 O ISIS 2212)",
        descriptionExpression: "Networking and architecture",
        expression: parsePrerequisiteExpression(
          "(ISIS 3204 O ISIS 2311) Y (ISIS 2503 O ISIS 2212)",
        )!,
      },
    ];
    plan.semesters[0].courses.push(course("networking", "ISIS-2311"));
    plan.semesters[1].courses.push(target);

    const evaluation = evaluatePlannedCourseRequirements(plan, "target");
    expect(evaluation.status).toBe("unmet");
    expect(evaluation.unmetPrerequisites[0].expression).toBe(
      "(ISIS-2503 O ISIS-2212)",
    );

    plan.semesters[0].courses.push(course("architecture", "ISIS-2212"));
    expect(evaluatePlannedCourseRequirements(plan, "target").status).toBe(
      "satisfied",
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

  it("removes the fulfilled language branch from the complete ISIS-3311 rule", () => {
    const plan = createBlankPlan(2);
    plan.recognizedRequirementIds = ["foreign-language-requirement"];
    const expression =
      "(ISIS 3204 O ISIS 2311) Y (ISIS 2503 O ISIS 2212) Y " +
      "(ISIS 2304 O ISIS 1511) Y " +
      "(LENG 1156 O LENG 3001 O RLEC1 O RLEN1 O INLE4 O INLE5 O INGL4 O ENGL7) Y " +
      "(ESCR 1102 O LITE 1622 O LENG 1512)";
    const target = course("target", "ISIS-3311");
    target.requirements!.prerequisites = [
      {
        codeExpression: expression,
        descriptionExpression:
          "(ENGLISH 06 O REQUISITO C1 LENG. PRIN. O RLEC1 O RLEN1 O INLE4 O INLE5 O INGL4 O ENGL7)",
        expression: parsePrerequisiteExpression(expression)!,
      },
    ];
    plan.semesters[1].courses.push(target);

    const languageOnly = evaluatePlannedCourseRequirements(plan, "target");
    expect(languageOnly.status).toBe("unmet");
    expect(languageOnly.unmetPrerequisites[0].expression).not.toContain(
      "ENGL7",
    );
    expect(languageOnly.unmetPrerequisites[0].expression).not.toContain(
      "LENG-1156",
    );
    expect(languageOnly.unmetPrerequisites[0].expression).toContain(
      "ISIS-3204",
    );
    expect(languageOnly.unmetPrerequisites[0].expression).toContain(
      "ESCR-1102",
    );

    plan.semesters[0].courses.push(
      course("networking", "ISIS-2311"),
      course("architecture", "ISIS-2212"),
      course("database", "ISIS-1511"),
      course("writing", "ESCR-1102"),
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
