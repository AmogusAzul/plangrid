import { describe, expect, it } from "vitest";
import type { PlannedCourse } from "../models/course";
import {
  getSemesterGridColumns,
  insertCourseAtSlot,
  normalizeSemesterCourses,
  positionSemesterCourses,
} from "./semesterLayout";

const course = (
  id: string,
  credits: number,
  slotStart?: number,
): PlannedCourse => ({
  id,
  code: `ISIS-${id}`,
  name: id,
  credits,
  slotStart,
});

describe("semesterLayout", () => {
  it("normalizes legacy courses into compact grid slots", () => {
    const normalized = normalizeSemesterCourses([
      course("A", 3),
      course("B", 4),
    ]);

    expect(normalized.map((entry) => entry.slotStart)).toEqual([1, 4]);
  });

  it("preserves an arbitrary open grid placement", () => {
    const positioned = positionSemesterCourses([
      course("A", 3, 1),
      course("B", 3, 10),
    ]);

    expect(positioned.map((entry) => entry.slotStart)).toEqual([1, 10]);
  });

  it("inserts between courses and shifts collisions forward", () => {
    const inserted = insertCourseAtSlot(
      [course("A", 3, 1), course("B", 3, 4)],
      course("C", 2),
      4,
    );

    expect(
      inserted.map((entry) => [entry.id, entry.slotStart]),
    ).toEqual([
      ["A", 1],
      ["C", 4],
      ["B", 6],
    ]);
  });

  it("displaces a course when dropping inside its occupied cells", () => {
    const inserted = insertCourseAtSlot(
      [course("A", 3, 1), course("B", 3, 4)],
      course("C", 2),
      2,
    );

    expect(
      inserted.map((entry) => [entry.id, entry.slotStart]),
    ).toEqual([
      ["C", 2],
      ["A", 4],
      ["B", 7],
    ]);
  });

  it("keeps overflow cards on the same linear row", () => {
    const positioned = positionSemesterCourses([course("A", 4, 20)]);

    expect(positioned[0]).toEqual(
      expect.objectContaining({ column: 20, slotStart: 20 }),
    );
  });

  it("expands the single row when occupied slots exceed the credit limit", () => {
    expect(getSemesterGridColumns([course("A", 4, 20)], 21)).toBe(23);
    expect(getSemesterGridColumns([course("A", 3, 1)], 21)).toBe(21);
  });
});
