export const COURSE_DRAG_TYPE = "application/x-plangrid-course";

export type CourseDragPayload =
  | {
      kind: "planned-course";
      courseId: string;
      grabOffset: number;
    }
  | {
      kind: "catalog-course";
      courseCode: string;
      grabOffset: number;
    };

export function serializeCourseDrag(payload: CourseDragPayload): string {
  return JSON.stringify(payload);
}

export function getGrabOffsetWithinSpan(
  relativeX: number,
  width: number,
  span: number,
): number {
  const safeSpan = Math.max(1, Math.trunc(span));
  if (width <= 0) return 0;

  const position = Math.max(0, Math.min(width - 1, relativeX));
  return Math.min(
    safeSpan - 1,
    Math.floor((position / width) * safeSpan),
  );
}

export function getSnappedCourseStart(
  pointerColumn: number,
  gridColumns: number,
  span: number,
  grabOffset: number,
): number {
  const safeSpan = Math.max(1, Math.trunc(span));
  const safeColumns = Math.max(safeSpan, Math.trunc(gridColumns));
  const offset = Math.min(
    safeSpan - 1,
    Math.max(0, Math.trunc(grabOffset)),
  );

  return Math.min(
    safeColumns - safeSpan + 1,
    Math.max(1, Math.trunc(pointerColumn) - offset),
  );
}

export function parseCourseDrag(value: string): CourseDragPayload | null {
  try {
    const payload: unknown = JSON.parse(value);
    if (!payload || typeof payload !== "object") return null;

    const candidate = payload as Partial<CourseDragPayload>;
    if (
      candidate.kind === "planned-course" &&
      typeof candidate.courseId === "string" &&
      candidate.courseId.length > 0 &&
      typeof candidate.grabOffset === "number" &&
      Number.isInteger(candidate.grabOffset) &&
      candidate.grabOffset >= 0
    ) {
      return {
        kind: candidate.kind,
        courseId: candidate.courseId,
        grabOffset: candidate.grabOffset,
      };
    }

    if (
      candidate.kind === "catalog-course" &&
      typeof candidate.courseCode === "string" &&
      candidate.courseCode.length > 0 &&
      typeof candidate.grabOffset === "number" &&
      Number.isInteger(candidate.grabOffset) &&
      candidate.grabOffset >= 0
    ) {
      return {
        kind: candidate.kind,
        courseCode: candidate.courseCode,
        grabOffset: candidate.grabOffset,
      };
    }

    return null;
  } catch {
    return null;
  }
}
