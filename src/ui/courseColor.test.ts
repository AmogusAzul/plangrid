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

  it("keeps seeded lightness within the white-text range", () => {
    const lightnessValues = Array.from({ length: 500 }, (_, index) => {
      const palette = getCoursePalette(course(`ISIS-${1000 + index}`));
      const match = / (\d+)%\)$/.exec(palette.background);
      return Number(match?.[1]);
    });

    expect(Math.min(...lightnessValues)).toBeGreaterThanOrEqual(22);
    expect(Math.max(...lightnessValues)).toBeLessThanOrEqual(48);
    expect(new Set(lightnessValues).size).toBeGreaterThan(20);
  });

  it("decorrelates neighboring course numbers with a seeded PRNG", () => {
    const lightnessValues = [
      "ISIS-1221",
      "ISIS-1222",
      "ISIS-1223",
      "ISIS-1224",
      "ISIS-1225",
    ].map((code) => getCoursePalette(course(code)).background.match(/ (\d+)%\)$/)?.[1]);

    expect(new Set(lightnessValues).size).toBeGreaterThan(3);
  });
});
