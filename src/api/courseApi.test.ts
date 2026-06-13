import { describe, expect, it, vi } from "vitest";
import {
  CourseApiError,
  getCourseByCode,
  normalizeCourseOfferings,
  parseCourseSearchInput,
  searchCourses,
} from "./courseApi";

const offering = {
  class: "ISIS",
  course: "1225",
  credits: "3",
  title: "ESTRUCTURAS DE DATOS Y ALGORITMOS",
};

describe("courseApi", () => {
  it("separates a course prefix and number", () => {
    expect(parseCourseSearchInput("isis-1225")).toEqual({
      prefix: "ISIS",
      query: "1225",
    });
    expect(parseCourseSearchInput("estructuras")).toEqual({
      prefix: "",
      query: "ESTRUCTURAS",
    });
  });

  it("normalizes and deduplicates offering rows", () => {
    expect(normalizeCourseOfferings([offering, offering])).toEqual([
      {
        code: "ISIS-1225",
        name: "ESTRUCTURAS DE DATOS Y ALGORITMOS",
        credits: 3,
        department: "ISIS",
      },
    ]);
  });

  it("ignores malformed offering rows", () => {
    expect(
      normalizeCourseOfferings([
        offering,
        { ...offering, credits: "not-a-number" },
        { ...offering, title: null },
      ]),
    ).toHaveLength(1);
  });

  it("builds a code-aware query and returns normalized courses", async () => {
    let requestedUrl = "";
    const fetchApi = async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([offering]), { status: 200 });
    };

    await expect(searchCourses("ISIS 1225", fetchApi)).resolves.toHaveLength(1);

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("prefix")).toBe("ISIS");
    expect(url.searchParams.get("nameInput")).toBe("1225");
  });

  it("finds an exact course code", async () => {
    const fetchApi = vi.fn(async () =>
      new Response(JSON.stringify([offering]), { status: 200 }),
    );

    await expect(getCourseByCode("isis 1225", fetchApi)).resolves.toEqual(
      expect.objectContaining({ code: "ISIS-1225" }),
    );
  });

  it("turns request failures into adapter errors", async () => {
    const fetchApi = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(searchCourses("ISIS", fetchApi)).rejects.toBeInstanceOf(
      CourseApiError,
    );
  });
});
