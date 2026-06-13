import { describe, expect, it } from "vitest";
import {
  getGrabOffsetRatio,
  getSnappedCourseStart,
  parseCourseDrag,
  serializeCourseDrag,
} from "./courseDrag";

describe("courseDrag", () => {
  it("round-trips planned and catalog payloads", () => {
    const planned = {
      kind: "planned-course",
      courseId: "local-id",
      grabOffsetRatio: 0.82,
    } as const;
    const catalog = {
      kind: "catalog-course",
      courseCode: "ISIS-1225",
      grabOffsetRatio: 0.35,
    } as const;

    expect(parseCourseDrag(serializeCourseDrag(planned))).toEqual(planned);
    expect(parseCourseDrag(serializeCourseDrag(catalog))).toEqual(catalog);
  });

  it("rejects malformed or unrelated drag data", () => {
    expect(parseCourseDrag("not-json")).toBeNull();
    expect(parseCourseDrag('{"kind":"planned-course"}')).toBeNull();
    expect(parseCourseDrag('{"kind":"other","courseId":"x"}')).toBeNull();
  });

  it("preserves the continuous grab offset from the card origin", () => {
    expect(getGrabOffsetRatio(1, 90)).toBeCloseTo(1 / 90);
    expect(getGrabOffsetRatio(45, 90)).toBe(0.5);
    expect(getGrabOffsetRatio(89, 90)).toBeCloseTo(89 / 90);
  });

  it("subtracts the continuous offset before snapping the card origin", () => {
    const contentWidth = 210;

    expect(
      getSnappedCourseStart(95, contentWidth, 21, 3, 0, 0),
    ).toBe(11);
    expect(
      getSnappedCourseStart(95, contentWidth, 21, 3, 0, 0.5),
    ).toBe(9);
    expect(
      getSnappedCourseStart(95, contentWidth, 21, 3, 0, 1),
    ).toBe(8);
  });

  it("accounts for grid gaps before snapping", () => {
    expect(
      getSnappedCourseStart(110, 250, 21, 3, 2, 0.75),
    ).toBe(8);
  });
});
