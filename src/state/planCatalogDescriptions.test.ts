import { describe, expect, it, vi } from "vitest";
import { createBlankPlan } from "./planFactory";
import { enrichPlanWithCatalogDescriptions } from "./planCatalogDescriptions";
import type { CatalogIndexFile } from "../models/catalogCourse";
import { resetCatalogIndexCache } from "../catalog/catalogIndex";

const index: CatalogIndexFile = {
  version: 1,
  catalogYear: "2026",
  generatedAt: "2026-06-17T00:00:00.000Z",
  sourceUrl: "https://example.test",
  courses: [
    {
      code: "ISIS-1225",
      normalizedCode: "ISIS-1225",
      title: "Estructuras de Datos y Algoritmos",
      credits: 3,
      departmentCode: "ISIS",
      departmentName: "Ingeniería de Sistemas y Computación",
      description: "Descripción de catálogo.",
      catalogUrl: "https://example.test/isis-1225",
      catalogYear: "2026",
      source: "smartcatalog",
      searchableText: "isis estructuras datos algoritmos",
    },
  ],
};

describe("enrichPlanWithCatalogDescriptions", () => {
  it("adds catalog descriptions to API-backed planned courses", async () => {
    resetCatalogIndexCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(index), { status: 200 }),
      ),
    );
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push({
      id: "course",
      code: "ISIS-1225",
      name: "Fresh API name",
      credits: 3,
      department: "ISIS",
      metadataSource: "api",
      availability: "api-available",
    });

    const enriched = await enrichPlanWithCatalogDescriptions(plan);

    expect(enriched.semesters[0].courses[0]).toEqual(
      expect.objectContaining({
        name: "Fresh API name",
        metadataSource: "api+catalog",
        catalog: expect.objectContaining({
          description: "Descripción de catálogo.",
          catalogUrl: "https://example.test/isis-1225",
        }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
