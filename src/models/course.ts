import type { CatalogCourseSummary } from "./catalogCourse";
import type { SearchResultAvailability } from "./searchResult";

export type CourseMetadataSource =
  | "api"
  | "catalog"
  | "api+catalog"
  | "custom"
  | "fallback";

export type Course = {
  code: string;
  name: string;
  credits: number;
  department?: string;
  metadataSource?: CourseMetadataSource;
  availability?: SearchResultAvailability;
  catalog?: CatalogCourseSummary;
  metadataFallback?: boolean;
};

export type PlannedCourse = Course & {
  id: string;
  slotStart?: number;
};
