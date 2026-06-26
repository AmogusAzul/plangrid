import type { CatalogCourseSummary } from "./catalogCourse";
import type { SearchResultAvailability } from "./searchResult";
import type { CourseRequirementCheck } from "./courseRequirement";

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
  requirements?: CourseRequirementCheck;
};

export type PlannedCourse = Course & {
  id: string;
  slotStart?: number;
  coursed?: boolean;
};
