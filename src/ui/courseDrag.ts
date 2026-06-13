export const COURSE_DRAG_TYPE = "application/x-plangrid-course";

export type CourseDragPayload =
  | {
      kind: "planned-course";
      courseId: string;
    }
  | {
      kind: "catalog-course";
      courseCode: string;
    };

export function serializeCourseDrag(payload: CourseDragPayload): string {
  return JSON.stringify(payload);
}

export function parseCourseDrag(value: string): CourseDragPayload | null {
  try {
    const payload: unknown = JSON.parse(value);
    if (!payload || typeof payload !== "object") return null;

    const candidate = payload as Partial<CourseDragPayload>;
    if (
      candidate.kind === "planned-course" &&
      typeof candidate.courseId === "string" &&
      candidate.courseId.length > 0
    ) {
      return {
        kind: candidate.kind,
        courseId: candidate.courseId,
      };
    }

    if (
      candidate.kind === "catalog-course" &&
      typeof candidate.courseCode === "string" &&
      candidate.courseCode.length > 0
    ) {
      return {
        kind: candidate.kind,
        courseCode: candidate.courseCode,
      };
    }

    return null;
  } catch {
    return null;
  }
}

