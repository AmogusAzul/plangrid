import { describe, expect, it, vi } from "vitest";
import {
  fetchCourseRequirements,
  normalizeCourseDetails,
} from "./courseRequirementsApi";

describe("course requirements API", () => {
  it("normalizes prerequisite and corequisite metadata", () => {
    expect(
      normalizeCourseDetails({
        nrc: "75358",
        term: "202620",
        ptrm: "1",
        coreq: [
          { subject: "FISI", coursenumber: "1518P", title: "Laboratorio" },
        ],
        prereq: [{ code: "MATE 1203", descr: "Calculo" }],
      }),
    ).toEqual(
      expect.objectContaining({
        status: "loaded",
        nrc: "75358",
        corequisites: [{ code: "FISI-1518P", title: "Laboratorio" }],
        prerequisites: [
          {
            codeExpression: "MATE 1203",
            descriptionExpression: "Calculo",
          },
        ],
      }),
    );
  });

  it("uses a later representative offering when the first detail call fails", async () => {
    const offerings = vi.fn(async () => [
      { term: "202620", ptrm: "1", nrc: "one" },
      { term: "202620", ptrm: "8A", nrc: "two" },
    ]);
    const fetchApi = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return url.searchParams.get("nrc") === "one"
        ? new Response("no", { status: 500 })
        : new Response(
            JSON.stringify({
              nrc: "two",
              term: "202620",
              ptrm: "8A",
              coreq: [],
              prereq: [],
            }),
            { status: 200 },
          );
    });

    await expect(
      fetchCourseRequirements("ISIS-1225", fetchApi, offerings),
    ).resolves.toEqual(expect.objectContaining({ nrc: "two" }));
  });

  it("returns not-offered without requesting details", async () => {
    const fetchApi = vi.fn();
    await expect(
      fetchCourseRequirements("ISIS-1105", fetchApi, async () => []),
    ).resolves.toEqual(
      expect.objectContaining({ status: "not-offered", term: "202620" }),
    );
    expect(fetchApi).not.toHaveBeenCalled();
  });
});
