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

  it("allows mock study-plan requirements to appear more than once", () => {
    const plan = createBlankPlan(1);
    const requirements = [
      ["CBUX-0000", "CBU", 3],
      ["CLEX-0000", "Creditos de Libre Eleccion", 3],
      ["ECXX-0000", "Electiva Cientifica", 3],
      ["EING-0000", "Electiva de Ingenieria", 2],
      ["EPXX-0000", "Electiva Profesional", 4],
    ] as const;

    requirements.forEach(([code, name, credits], index) => {
      const requirement = {
        id: `semester-${index}`,
        code,
        name,
        credits,
      };
      plan.semesters[0].courses.push(requirement);
      plan.storage.push({ ...requirement, id: `storage-${index}` });
    });

    expect(
      validatePlan(plan).filter((warning) => warning.id.startsWith("duplicate-")),
    ).toEqual([]);
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

  it("does not warn when credits equal the configured limit", () => {
    const plan = createBlankPlan(1);
    plan.creditLimitPerSemester = 3;
    plan.semesters[0].courses.push({
      id: "one",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });

    expect(validatePlan(plan)).toEqual([]);
  });

  it("totals credits across every semester and storage", () => {
    const plan = createBlankPlan(2);
    plan.semesters[0].courses.push({
      id: "semester-one",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
    });
    plan.semesters[1].courses.push({
      id: "semester-two",
      code: "MATE-1203",
      name: "Calculus",
      credits: 4,
    });
    plan.storage.push({
      id: "storage",
      code: "FISI-1518",
      name: "Physics",
      credits: 4,
    });

    expect(getTotalPlanCredits(plan)).toBe(11);
  });

  it("warns when imported course metadata uses a fallback", () => {
    const plan = createBlankPlan(1);
    plan.storage.push({
      id: "fallback",
      code: "UNKNOWN-1000",
      name: "Unknown course (UNKNOWN-1000)",
      credits: 3,
      metadataFallback: true,
    });

    expect(validatePlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "metadata-fallback-UNKNOWN-1000",
          relatedCourseCodes: ["UNKNOWN-1000"],
        }),
      ]),
    );
  });
});
