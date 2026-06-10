export type PlanWarning = {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  relatedCourseCodes?: string[];
  relatedSemesterIds?: string[];
};

