import { describe, expect, it, vi } from "vitest";
import type { Course } from "../models/course";
import { createBlankPlan } from "../state/planFactory";
import {
  importPlanFile,
  parsePlanFile,
  PlanFileError,
  serializePlanFile,
  exportPlanFile,
} from "./csvExport";

const catalog = new Map<string, Course>([
  [
    "ISIS-1221",
    {
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
      department: "ISIS",
    },
  ],
  [
    "MATE-1203",
    {
      code: "MATE-1203",
      name: "Calculus",
      credits: 4,
      department: "MATE",
    },
  ],
]);

describe("plan file export", () => {
  it("serializes quoted metadata, variable slots, semesters, and storage", () => {
    const plan = createBlankPlan(2);
    plan.name = 'Plan, "Special"';
    plan.creditLimitPerSemester = 6;
    plan.semesters[0].courses.push({
      id: "course-1",
      code: "ISIS-1221",
      name: "Programming",
      credits: 3,
      slotStart: 8,
    });
    plan.storage.push({
      id: "course-2",
      code: "MATE-1203",
      name: "Calculus",
      credits: 4,
    });

    const text = serializePlanFile(plan);
    const parsed = parsePlanFile(text);

    expect(text).toContain('plan_name,"Plan, ""Special"""');
    expect(text).toContain("[courses]");
    expect(text).toContain("format_version,5");
    expect(text).toContain("metadata_source,availability");
    expect(text).toContain("ISIS-1221,Programming,3");
    expect(text).toContain("slot_10");
    expect(parsed.name).toBe('Plan, "Special"');
    expect(parsed.id).toBe(plan.id);
    expect(parsed.createdAt).toBe(plan.createdAt);
    expect(parsed.cachedCourses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ISIS-1221",
          name: "Programming",
          credits: 3,
        }),
      ]),
    );
    expect(parsed.semesters).toHaveLength(2);
    expect(parsed.semesters[0].courses).toEqual([
      { code: "ISIS-1221", slotStart: 8 },
    ]);
    expect(parsed.storageCodes).toEqual(["MATE-1203"]);
  });

  it("rejects unknown versions and malformed required sections", () => {
    const plan = createBlankPlan(1);
    const text = serializePlanFile(plan);

    expect(() =>
      parsePlanFile(text.replace("format_version,5", "format_version,99")),
    ).toThrow(PlanFileError);
    expect(() =>
      parsePlanFile(text.replace("[storage]", "[backlog]")),
    ).toThrow("Missing required [storage] section");
  });

  it("downloads the sectioned CSV using the .plan extension", () => {
    const plan = createBlankPlan(1);
    plan.name = "My Plan";
    const download = vi.fn();

    exportPlanFile(plan, new Date(2026, 5, 13), download);

    expect(download).toHaveBeenCalledWith(
      expect.stringContaining("[semesters]"),
      "my-plan-2026-06-13.plan",
      "text/csv;charset=utf-8",
    );
  });
});

describe("plan file import", () => {
  it("looks up each unique code once while preserving duplicate occurrences", async () => {
    const plan = createBlankPlan(2);
    plan.semesters[0].courses.push({
      id: "course-1",
      ...catalog.get("ISIS-1221")!,
      slotStart: 2,
    });
    plan.semesters[1].courses.push({
      id: "course-2",
      ...catalog.get("ISIS-1221")!,
      slotStart: 5,
    });
    plan.storage.push({
      id: "course-3",
      ...catalog.get("MATE-1203")!,
    });
    const lookup = vi.fn(async (code: string) => catalog.get(code) ?? null);

    const imported = await importPlanFile(serializePlanFile(plan), lookup);

    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup).toHaveBeenCalledWith("ISIS-1221");
    expect(lookup).toHaveBeenCalledWith("MATE-1203");
    expect(imported.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({ code: "ISIS-1221", slotStart: 2 }),
    );
    expect(imported.plan.semesters[1].courses[0]).toEqual(
      expect.objectContaining({ code: "ISIS-1221", slotStart: 5 }),
    );
    expect(imported.plan.semesters[0].courses[0].id).not.toBe(
      imported.plan.semesters[1].courses[0].id,
    );
    expect(imported.plan.storage[0].code).toBe("MATE-1203");
  });

  it("uses cached metadata when fresh lookup fails", async () => {
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push({
      id: "cached",
      code: "ISIS-1221",
      name: "Cached programming",
      credits: 3,
      department: "ISIS",
    });

    const imported = await importPlanFile(
      serializePlanFile(plan),
      async () => {
        throw new Error("offline");
      },
    );

    expect(imported.fallbackCodes).toEqual([]);
    expect(imported.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        name: "Cached programming",
        credits: 3,
      }),
    );
  });

  it("prefers fresh metadata over cached values", async () => {
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push({
      id: "cached",
      code: "ISIS-1221",
      name: "Cached programming",
      credits: 3,
    });

    const imported = await importPlanFile(
      serializePlanFile(plan),
      async () => ({
        code: "ISIS-1221",
        name: "Fresh programming",
        credits: 4,
        department: "ISIS",
      }),
    );

    expect(imported.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        name: "Fresh programming",
        credits: 4,
      }),
    );
    expect(
      Object.hasOwn(
        imported.plan.semesters[0].courses[0],
        "metadataFallback",
      ),
    ).toBe(false);
  });

  it("exports and imports catalog, requirement, and recognition metadata in format version 5", async () => {
    const plan = createBlankPlan(1);
    plan.recognizedRequirementIds = ["homologated-precalculus"];
    plan.semesters[0].courses.push({
      id: "catalog-only",
      code: "DERE-3001",
      name: "Derecho Ambiental",
      credits: 3,
      department: "DERE",
      metadataSource: "catalog",
      availability: "catalog-only",
      catalog: {
        title: "Derecho Ambiental",
        description: "Estudia regulación ambiental.",
        departmentCode: "DERE",
        departmentName: "Derecho",
        catalogYear: "2026",
        catalogUrl: "https://example.test/dere-3001",
      },
      requirements: {
        status: "loaded",
        term: "202620",
        checkedAt: "2026-06-22T00:00:00.000Z",
        nrc: "12345",
        partOfTerm: "1",
        prerequisites: [
          {
            codeExpression: "DERE 1001",
            descriptionExpression: "Introduccion al Derecho",
            expression: {
              type: "course",
              code: "DERE-1001",
              concurrent: true,
            },
          },
        ],
        corequisites: [{ code: "DERE-3001L", title: "Laboratorio" }],
      },
    });

    const text = serializePlanFile(plan);
    const imported = await importPlanFile(text, async () => null);

    expect(text).toContain("catalog_description");
    expect(text).toContain("[requirement_checks]");
    expect(text).toContain("[prerequisites]");
    expect(text).toContain("[corequisites]");
    expect(text).toContain("[recognized_requirements]");
    expect(text).toContain("DERE-1001*");
    expect(imported.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        availability: "catalog-only",
        metadataSource: "catalog",
        catalog: expect.objectContaining({
          description: "Estudia regulación ambiental.",
          catalogUrl: "https://example.test/dere-3001",
        }),
        requirements: expect.objectContaining({
          status: "loaded",
          nrc: "12345",
          prerequisites: [
            expect.objectContaining({
              expression: {
                type: "course",
                code: "DERE-1001",
                concurrent: true,
              },
            }),
          ],
          corequisites: [{ code: "DERE-3001L", title: "Laboratorio" }],
        }),
      }),
    );
    expect(imported.plan.recognizedRequirementIds).toEqual([
      "homologated-precalculus",
    ]);
  });

  it("uses persistent three-credit fallback metadata when lookup fails", async () => {
    const text = [
      "[plan]",
      "format_version,1",
      "plan_name,Fallback plan",
      "credit_limit,21",
      "",
      "[semesters]",
      "semester,term,slot_1",
      "Semester 1,2026-20,UNKNOWN-1000",
      "",
      "[storage]",
      "course_code",
      "UNKNOWN-1000",
      "",
    ].join("\n");

    const imported = await importPlanFile(text, async () => null);

    expect(imported.fallbackCodes).toEqual(["UNKNOWN-1000"]);
    expect(imported.plan.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        code: "UNKNOWN-1000",
        credits: 3,
        metadataFallback: true,
      }),
    );
    expect(imported.plan.storage[0]).toEqual(
      expect.objectContaining({
        code: "UNKNOWN-1000",
        metadataFallback: true,
      }),
    );
  });
});
