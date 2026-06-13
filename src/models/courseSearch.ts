import type { Course } from "./course";

export type CourseSearchState = {
  query: string;
  status: "idle" | "loading" | "success" | "error";
  results: Course[];
  error: string | null;
};

export const initialCourseSearchState: CourseSearchState = {
  query: "",
  status: "idle",
  results: [],
  error: null,
};

