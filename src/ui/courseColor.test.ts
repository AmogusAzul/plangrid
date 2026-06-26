import { describe, expect, it } from "vitest";
import type { Course } from "../models/course";
import { getCoursePalette } from "./courseColor";

const course = (code: string): Course => ({
  code,
  name: code,
  credits: 3,
  department: code.split("-")[0],
});

describe("getCoursePalette", () => {
  it("is deterministic across repeated assignments", () => {
    expect(getCoursePalette(course("ISIS-1225"))).toEqual(
      getCoursePalette(course("ISIS-1225")),
    );
  });

  it("maps the first course-code digit to descending lightness brackets", () => {
    expect(getCoursePalette(course("ISIS-1221")).background).toMatch(/ 48%\)$/);
    expect(getCoursePalette(course("ISIS-2221")).background).toMatch(/ 40%\)$/);
    expect(getCoursePalette(course("ISIS-3221")).background).toMatch(/ 32%\)$/);
    expect(getCoursePalette(course("ISIS-4221")).background).toMatch(/ 24%\)$/);
  });

  it("uses the enabled ISIS plan course override while keeping level lightness", () => {
    expect(getCoursePalette(course("ISIS-1611")).background).toBe(
      "hsl(260 86% 48%)",
    );
  });

  it("can disable the ISIS plan course override", () => {
    expect(getCoursePalette(course("ISIS-1611"), []).background).not.toBe(
      "hsl(260 86% 48%)",
    );
  });

  it("uses the enabled Friendly MATE department override", () => {
    const matePalette = getCoursePalette(course("MATE-1203"));

    expect(matePalette.background).not.toBe(
      getCoursePalette({
        code: "PLAN-1203",
        name: "PLAN-1203",
        credits: 3,
        department: "PLAN",
      }).background,
    );
    expect(matePalette.background).toMatch(/^hsl\(\d+ \d+% 48%\)$/);
  });

  it("can disable the Friendly MATE department override", () => {
    expect(getCoursePalette(course("MATE-1203"), []).background).not.toEqual(
      getCoursePalette(course("MATE-1203")).background,
    );
  });
});
