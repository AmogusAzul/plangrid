import { beforeEach, describe, expect, it } from "vitest";
import type { Course } from "../models/course";
import {
  clearCoursePaletteCache,
  getCoursePalette,
} from "./courseColor";

const course = (code: string): Course => ({
  code,
  name: code,
  credits: 3,
  department: code.split("-")[0],
});

describe("getCoursePalette", () => {
  beforeEach(() => {
    clearCoursePaletteCache();
  });

  it("keeps a randomly assigned color stable during the session", () => {
    const first = getCoursePalette(course("ISIS-1225"), () => 0.1);
    const cached = getCoursePalette(course("ISIS-1225"), () => 0.9);

    expect(cached).toEqual(first);
  });

  it("uses the full readable lightness range", () => {
    const darkest = getCoursePalette(course("ISIS-1000"), () => 0);
    const lightest = getCoursePalette(course("ISIS-1001"), () => 1);

    expect(darkest.background).toMatch(/ 24%\)$/);
    expect(darkest.foreground).toBe("#ffffff");
    expect(lightest.background).toMatch(/ 72%\)$/);
    expect(lightest.foreground).toBe("#172019");
  });

  it("does not derive lightness from similar course numbers", () => {
    const first = getCoursePalette(course("ISIS-1224"), () => 0);
    const second = getCoursePalette(course("ISIS-1225"), () => 1);

    expect(first.background).toMatch(/ 24%\)$/);
    expect(second.background).toMatch(/ 72%\)$/);
  });
});
