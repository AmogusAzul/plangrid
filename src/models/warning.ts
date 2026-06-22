export type PlanWarning = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  relatedCourseCodes?: string[];
  relatedCourseIds?: string[];
  relatedSemesterIds?: string[];
};
