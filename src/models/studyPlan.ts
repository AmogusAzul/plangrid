import type { PlannedCourse } from "./course";

export type PlanSemester = {
  id: string;
  label: string;
  termHint: string;
  courses: PlannedCourse[];
};

export type StudyPlan = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  creditLimitPerSemester: number;
  semesters: PlanSemester[];
  storage: PlannedCourse[];
};

