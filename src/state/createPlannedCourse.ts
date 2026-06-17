import type { Course, PlannedCourse } from "../models/course";
import type { CourseSearchResult } from "../models/searchResult";
import { createId } from "./planFactory";

export function createPlannedCourseFromCourse(
  course: Course | CourseSearchResult,
): PlannedCourse {
  return {
    ...course,
    id: createId(),
    metadataSource: course.metadataSource ?? "api",
  };
}
