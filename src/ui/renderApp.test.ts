import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import { createBlankPlan } from "../state/planFactory";
import { parsePrerequisiteExpression } from "../requirements/prerequisiteParser";
import { courseCard, requirementDetails } from "./renderApp";

describe("course card actions", () => {
  for (const credits of [0, 1, 2]) {
    it(`keeps details and remove visible for a ${credits}-credit course`, () => {
      const course: PlannedCourse = {
        id: `course-${credits}`,
        code: `TEST-${credits}`,
        name: "Narrow course",
        credits,
      };

      const html = courseCard(
        course,
        new Set(),
        new Set(),
        true,
      );

      expect(html).toContain(`data-course-details="${course.id}"`);
      expect(html).toContain(`data-remove-course="${course.id}"`);
      expect(html).toContain(`aria-label="Open details for ${course.code}"`);
      expect(html).toContain(`aria-label="Remove ${course.code}"`);
      expect(html).toContain(
        `title="${course.code}\n${course.name}\n${credits} credits"`,
      );
      expect(html).not.toContain("data-store-course");
      expect(html).not.toContain(">Store<");
    });
  }
});

describe("course requirement details", () => {
  it("shows normalized rules while limiting unmet text to residual branches", () => {
    const plan = createBlankPlan(2);
    const target: PlannedCourse = {
      id: "target",
      code: "ISIS-3311",
      name: "Infrastructure",
      credits: 3,
      requirements: {
        status: "loaded",
        term: "202620",
        checkedAt: "2026-06-22T00:00:00.000Z",
        nrc: "12345",
        partOfTerm: "1",
        prerequisites: [
          {
            codeExpression:
              "(ISIS 3204 O ISIS 2311) Y (ENGL7 O INGL4)",
            descriptionExpression:
              "Networking and foreign-language requirement",
            expression: parsePrerequisiteExpression(
              "(ISIS 3204 O ISIS 2311) Y (ENGL7 O INGL4)",
            )!,
          },
        ],
        corequisites: [],
      },
    };
    plan.recognizedRequirementIds = ["foreign-language-requirement"];
    plan.semesters[1].courses.push(target);

    const html = requirementDetails(target, plan);

    expect(html).toContain("Unmet");
    expect(html).toContain("Still needed: (ISIS-3204 O ISIS-2311)");
    expect(html).toContain(
      "((ISIS-3204 O ISIS-2311) Y (ENGL7 O INGL4))",
    );
    expect(html).toContain(
      "API expression: (ISIS 3204 O ISIS 2311) Y (ENGL7 O INGL4)",
    );
  });

  it("does not mark an unplaced search result as satisfied", () => {
    const plan = createBlankPlan(1);
    const course = {
      code: "MATE-1203",
      name: "Calculus",
      credits: 3,
      requirements: {
        status: "loaded" as const,
        term: "202620" as const,
        checkedAt: "2026-06-22T00:00:00.000Z",
        prerequisites: [
          {
            codeExpression: "MATE 1201*",
            descriptionExpression: "Precalculus",
            expression: parsePrerequisiteExpression("MATE 1201*")!,
          },
        ],
        corequisites: [],
      },
    };

    const html = requirementDetails(course, plan);

    expect(html).toContain("Not evaluated");
    expect(html).not.toContain(">Satisfied<");
    expect(html).toContain("MATE-1201*");
  });
});
