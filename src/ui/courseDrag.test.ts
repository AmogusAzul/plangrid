import { describe, expect, it } from "vitest";
import {
  getGrabOffsetWithinSpan,
  getSnappedCourseStart,
  parseCourseDrag,
  serializeCourseDrag,
} from "./courseDrag";

describe("courseDrag", () => {
  it("round-trips planned and catalog payloads", () => {
    const planned = {
      kind: "planned-course",
      courseId: "local-id",
      grabOffset: 2,
    } as const;
    const catalog = {
      kind: "catalog-course",
      courseCode: "ISIS-1225",
      grabOffset: 1,
    } as const;

    expect(parseCourseDrag(serializeCourseDrag(planned))).toEqual(planned);
    expect(parseCourseDrag(serializeCourseDrag(catalog))).toEqual(catalog);
  });

  it("rejects malformed or unrelated drag data", () => {
    expect(parseCourseDrag("not-json")).toBeNull();
    expect(parseCourseDrag('{"kind":"planned-course"}')).toBeNull();
    expect(parseCourseDrag('{"kind":"other","courseId":"x"}')).toBeNull();
  });

  it("maps the grabbed point to a course-cell offset", () => {
    expect(getGrabOffsetWithinSpan(1, 90, 3)).toBe(0);
    expect(getGrabOffsetWithinSpan(45, 90, 3)).toBe(1);
    expect(getGrabOffsetWithinSpan(89, 90, 3)).toBe(2);
  });

  it("keeps the grabbed cell under the pointer after snapping", () => {
    expect(getSnappedCourseStart(10, 21, 3, 0)).toBe(10);
    expect(getSnappedCourseStart(10, 21, 3, 2)).toBe(8);
    expect(getSnappedCourseStart(21, 21, 3, 2)).toBe(19);
  });
});
