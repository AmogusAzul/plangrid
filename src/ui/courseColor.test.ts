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
  it("is deterministic", () => {
    expect(getCoursePalette(course("ISIS-1225"))).toEqual(
      getCoursePalette(course("ISIS-1225")),
    );
  });

  it("uses a broad but readable lightness range", () => {
    const palettes = Array.from({ length: 100 }, (_, index) =>
      getCoursePalette(course(`ISIS-${1000 + index}`)),
    );
    const lightnessValues = palettes.map((palette) => {
      const match = / (\d+)%\)$/.exec(palette.background);
      return Number(match?.[1]);
    });

    expect(new Set(lightnessValues).size).toBeGreaterThan(30);
    expect(Math.min(...lightnessValues)).toBeGreaterThanOrEqual(24);
    expect(Math.max(...lightnessValues)).toBeLessThanOrEqual(72);
  });

  it("varies colors between courses in the same department", () => {
    const colors = [
      "ISIS-1204",
      "ISIS-1221",
      "ISIS-1225",
      "ISIS-1404",
      "ISIS-2203",
    ].map((code) => getCoursePalette(course(code)).background);

    expect(new Set(colors).size).toBe(colors.length);
  });
});
