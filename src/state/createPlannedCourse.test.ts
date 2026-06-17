import { describe, expect, it } from "vitest";
import { createPlannedCourseFromCourse } from "./createPlannedCourse";

describe("createPlannedCourseFromCourse", () => {
  it("preserves catalog-only metadata while assigning a local id", () => {
    const planned = createPlannedCourseFromCourse({
      code: "DERE-3001",
      name: "Derecho Ambiental",
      credits: 3,
      department: "DERE",
      metadataSource: "catalog",
      availability: "catalog-only",
      catalog: {
        description: "Catalog description",
        catalogUrl: "https://example.test",
      },
    });

    expect(planned).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        metadataSource: "catalog",
        availability: "catalog-only",
        catalog: expect.objectContaining({
          description: "Catalog description",
        }),
      }),
    );
  });
});
