import type { PlannedCourse } from "./course";
import type { RecognizedRequirementId } from "./recognizedRequirement";

export type PlanSemester = {
  id: string;
  label: string;
  termHint: string;
  courses: PlannedCourse[];
};

export type StudyPlan = {
  id: string;
  filename: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  creditLimitPerSemester: number;
  semesters: PlanSemester[];
  storage: PlannedCourse[];
  recognizedRequirementIds: RecognizedRequirementId[];
  colorOverrideSchemeIds: string[];
};
