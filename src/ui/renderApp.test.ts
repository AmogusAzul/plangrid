import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import { courseCard } from "./renderApp";

describe("course card actions", () => {
  for (const credits of [0, 1, 2]) {
    it(`keeps details and remove visible for a ${credits}-credit course`, () => {
      const course: PlannedCourse = {
        id: `course-${credits}`,
        code: `TEST-${credits}`,
        name: "Narrow course",
        credits,
      };

      const html = courseCard(
        course,
        new Set(),
        new Set(),
        true,
      );

      expect(html).toContain(`data-course-details="${course.id}"`);
      expect(html).toContain(`data-remove-course="${course.id}"`);
      expect(html).toContain(`aria-label="Open details for ${course.code}"`);
      expect(html).toContain(`aria-label="Remove ${course.code}"`);
      expect(html).toContain(
        `title="${course.code}\n${course.name}\n${credits} credits"`,
      );
      expect(html).not.toContain("data-store-course");
      expect(html).not.toContain(">Store<");
    });
  }
});
