import { describe, expect, it, vi } from "vitest";
import {
  CourseApiError,
  getCourseByCode,
  normalizeCourseOfferings,
  parseCourseSearchInput,
  searchRequirementCourses,
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

  it("uses the official wildcard encoding for multi-word names", async () => {
    let requestedUrl = "";
    const fetchApi = async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response("[]", { status: 200 });
    };

    await searchCourses("FÍSICA I", fetchApi);

    expect(requestedUrl).toContain("nameInput=F%C3%8DSICA%2525I");
  });

  it("paginates name searches and ranks exact titles first", async () => {
    const broadMatch = {
      class: "CBUT",
      course: "1044",
      credits: "3",
      title: "TESOROS DE LA FÍSICA Y SUS DESCUBRIDORES",
    };
    const exactMatch = {
      class: "FISI",
      course: "1518",
      credits: "3",
      title: "FÍSICA I",
    };
    const firstPage = Array.from({ length: 25 }, () => broadMatch);
    const requestedOffsets: string[] = [];
    const fetchApi = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedOffsets.push(url.searchParams.get("offset") ?? "");
      const rows = url.searchParams.get("offset") === "0"
        ? firstPage
        : [exactMatch];
      return new Response(JSON.stringify(rows), { status: 200 });
    };

    const courses = await searchCourses("FÍSICA I", fetchApi);

    expect(requestedOffsets).toEqual(["0", "25"]);
    expect(courses[0].code).toBe("FISI-1518");
  });

  it("finds an exact course code", async () => {
    const fetchApi = vi.fn(async () =>
      new Response(JSON.stringify([offering]), { status: 200 }),
    );

    await expect(getCourseByCode("isis 1225", fetchApi)).resolves.toEqual(
      expect.objectContaining({ code: "ISIS-1225" }),
    );
  });

  it("searches local study-plan requirements by acronym and partial name", () => {
    expect(searchRequirementCourses("CBU")[0]).toEqual(
      expect.objectContaining({ code: "CBUX-0000", credits: 3 }),
    );
    expect(searchRequirementCourses("EP")[0]).toEqual(
      expect.objectContaining({ code: "EPXX-0000" }),
    );
    expect(searchRequirementCourses("Electiva Prof")[0]).toEqual(
      expect.objectContaining({
        code: "EPXX-0000",
        name: "Electiva Profesional",
      }),
    );
    expect(searchRequirementCourses("creditos libre")).toEqual([
      expect.objectContaining({ code: "CLEX-0000" }),
    ]);
  });

  it("returns matching requirements even when the live API fails", async () => {
    const fetchApi = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(searchCourses("Electiva Prof", fetchApi)).resolves.toEqual([
      expect.objectContaining({ code: "EPXX-0000" }),
    ]);
  });

  it("hydrates requirement codes without calling the live API", async () => {
    const fetchApi = vi.fn();

    await expect(getCourseByCode("CBUX-0000", fetchApi)).resolves.toEqual(
      expect.objectContaining({ name: "CBU", credits: 3 }),
    );
    expect(fetchApi).not.toHaveBeenCalled();
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
