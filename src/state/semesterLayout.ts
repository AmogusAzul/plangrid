import type { PlannedCourse } from "../models/course";

export const SEMESTER_GRID_COLUMNS = 21;

export type PositionedCourse = {
  course: PlannedCourse;
  slotStart: number;
  column: number;
  span: number;
};

function courseSpan(course: PlannedCourse): number {
  return Math.min(
    SEMESTER_GRID_COLUMNS,
    Math.max(1, Math.trunc(course.credits)),
  );
}

function rangesOverlap(
  leftStart: number,
  leftSpan: number,
  rightStart: number,
  rightSpan: number,
): boolean {
  const leftEnd = leftStart + leftSpan - 1;
  const rightEnd = rightStart + rightSpan - 1;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function firstOpenSlot(
  requestedSlot: number,
  span: number,
  positioned: PositionedCourse[],
): number {
  let candidate = Math.max(1, Math.trunc(requestedSlot));

  while (
    positioned.some((entry) =>
      rangesOverlap(candidate, span, entry.slotStart, entry.span),
    )
  ) {
    candidate += 1;
  }

  return candidate;
}

export function positionSemesterCourses(
  courses: PlannedCourse[],
): PositionedCourse[] {
  const positioned: PositionedCourse[] = [];

  for (const course of courses) {
    const span = courseSpan(course);
    const requestedSlot =
      course.slotStart ??
      (positioned.length === 0
        ? 1
        : Math.max(
            ...positioned.map((entry) => entry.slotStart + entry.span),
          ));
    const slotStart = firstOpenSlot(requestedSlot, span, positioned);

    positioned.push({
      course,
      slotStart,
      column: slotStart,
      span,
    });
  }

  return positioned;
}

export function getSemesterGridColumns(
  courses: PlannedCourse[],
  creditLimit: number,
): number {
  const positioned = positionSemesterCourses(courses);
  const occupiedColumns =
    positioned.length === 0
      ? 0
      : Math.max(
          ...positioned.map((entry) => entry.slotStart + entry.span - 1),
        );

  return Math.max(1, Math.trunc(creditLimit), occupiedColumns);
}

export function normalizeSemesterCourses(
  courses: PlannedCourse[],
): PlannedCourse[] {
  return positionSemesterCourses(courses).map(({ course, slotStart }) => ({
    ...course,
    slotStart,
  }));
}

export function insertCourseAtSlot(
  courses: PlannedCourse[],
  course: PlannedCourse,
  requestedSlot?: number,
): PlannedCourse[] {
  const existing = normalizeSemesterCourses(courses);
  const slotStart =
    requestedSlot ??
    (existing.length === 0
      ? 1
      : Math.max(
          ...existing.map(
            (entry) =>
              (entry.slotStart ?? 1) + courseSpan(entry),
          ),
        ));
  const inserted = {
    ...course,
    slotStart: Math.max(1, Math.trunc(slotStart)),
  };
  const before = existing.filter(
    (entry) =>
      (entry.slotStart ?? 1) + courseSpan(entry) - 1 <
      inserted.slotStart!,
  );
  const beforeIds = new Set(before.map((entry) => entry.id));
  const after = existing.filter(
    (entry) => !beforeIds.has(entry.id),
  );

  return normalizeSemesterCourses([inserted, ...after]).reduce(
    (result, entry, index) => {
      if (index === 0) {
        result.push(...before, entry);
        return result;
      }

      result.push(entry);
      return result;
    },
    [] as PlannedCourse[],
  ).sort((left, right) => (left.slotStart ?? 1) - (right.slotStart ?? 1));
}
