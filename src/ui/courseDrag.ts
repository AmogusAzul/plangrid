export const COURSE_DRAG_TYPE = "application/x-plangrid-course";

export type CourseDragPayload =
  | {
      kind: "planned-course";
      courseId: string;
      grabOffsetRatio: number;
    }
  | {
      kind: "catalog-course";
      courseCode: string;
      grabOffsetRatio: number;
    };

export function serializeCourseDrag(payload: CourseDragPayload): string {
  return JSON.stringify(payload);
}

export function getGrabOffsetRatio(
  relativeX: number,
  width: number,
): number {
  if (width <= 0) return 0;

  return Math.max(0, Math.min(1, relativeX / width));
}

export function getSnappedCourseStart(
  pointerX: number,
  contentWidth: number,
  gridColumns: number,
  span: number,
  columnGap: number,
  grabOffsetRatio: number,
): number {
  const safeSpan = Math.max(1, Math.trunc(span));
  const safeColumns = Math.max(safeSpan, Math.trunc(gridColumns));
  const safeGap = Math.max(0, columnGap);
  const cellWidth =
    (contentWidth - safeGap * (safeColumns - 1)) / safeColumns;
  const columnPitch = cellWidth + safeGap;
  const courseWidth = cellWidth * safeSpan + safeGap * (safeSpan - 1);
  const offsetRatio = Math.max(
    0,
    Math.min(1, grabOffsetRatio),
  );
  const prospectiveLeft = pointerX - offsetRatio * courseWidth;
  const snappedColumnIndex = Math.round(
    prospectiveLeft / Math.max(1, columnPitch),
  );

  return Math.min(
    safeColumns - safeSpan + 1,
    Math.max(1, snappedColumnIndex + 1),
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
      typeof candidate.grabOffsetRatio === "number" &&
      Number.isFinite(candidate.grabOffsetRatio) &&
      candidate.grabOffsetRatio >= 0 &&
      candidate.grabOffsetRatio <= 1
    ) {
      return {
        kind: candidate.kind,
        courseId: candidate.courseId,
        grabOffsetRatio: candidate.grabOffsetRatio,
      };
    }

    if (
      candidate.kind === "catalog-course" &&
      typeof candidate.courseCode === "string" &&
      candidate.courseCode.length > 0 &&
      typeof candidate.grabOffsetRatio === "number" &&
      Number.isFinite(candidate.grabOffsetRatio) &&
      candidate.grabOffsetRatio >= 0 &&
      candidate.grabOffsetRatio <= 1
    ) {
      return {
        kind: candidate.kind,
        courseCode: candidate.courseCode,
        grabOffsetRatio: candidate.grabOffsetRatio,
      };
    }

    return null;
  } catch {
    return null;
  }
}
