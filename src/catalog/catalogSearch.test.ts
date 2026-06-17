import { describe, expect, it } from "vitest";
import type { CatalogIndexFile } from "../models/catalogCourse";
import { resetCatalogIndexCache } from "./catalogIndex";
import { resetCatalogSearchCache, searchCatalogCourses } from "./catalogSearch";

const index: CatalogIndexFile = {
  version: 1,
  catalogYear: "2026",
  generatedAt: "2026-06-17T00:00:00.000Z",
  sourceUrl: "https://example.test",
  courses: [
    {
      code: "ISIS-1105",
      normalizedCode: "ISIS-1105",
      title: "Diseño y Análisis de Algoritmos",
      credits: 3,
      departmentCode: "ISIS",
      description: "Incluye programación dinámica y optimización.",
      catalogYear: "2026",
      source: "smartcatalog",
      searchableText:
        "isis 1105 diseno analisis algoritmos programacion dinamica optimizacion",
    },
    {
      code: "DERE-3001",
      normalizedCode: "DERE-3001",
      title: "Derecho Ambiental",
      credits: 3,
      departmentCode: "DERE",
      description: "Estudia regulación ambiental.",
      catalogYear: "2026",
      source: "smartcatalog",
      searchableText: "dere 3001 derecho ambiental regulacion ambiental",
    },
  ],
};

function fetchIndex(): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(index), { status: 200 }));
}

describe("catalog search", () => {
  it("finds description matches and applies department filters", async () => {
    resetCatalogIndexCache();
    resetCatalogSearchCache();

    const results = await searchCatalogCourses(
      "programación dinámica",
      { department: "ISIS", source: "all" },
      10,
      fetchIndex,
    );

    expect(results).toEqual([
      expect.objectContaining({
        code: "ISIS-1105",
        matchedSnippet: expect.stringContaining("programación dinámica"),
      }),
    ]);
  });

  it("uses modest synonym expansion", async () => {
    resetCatalogIndexCache();
    resetCatalogSearchCache();

    const results = await searchCatalogCourses(
      "algorithms",
      { department: "all", source: "all" },
      10,
      fetchIndex,
    );

    expect(results[0].code).toBe("ISIS-1105");
  });
});
