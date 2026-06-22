import type { Course } from "../models/course";

export type CourseLookup = (code: string) => Promise<Course | null>;

export type HydratedCourses = {
  courses: Map<string, Course>;
  cachedCodes: string[];
  fallbackCodes: string[];
};

function normalizeCourse(course: Course): Course {
  return {
    ...course,
    code: course.code.trim().toUpperCase(),
    department: course.department?.trim().toUpperCase() || undefined,
  };
}

function fallbackCourse(code: string): Course {
  return {
    code,
    name: `Unknown course (${code})`,
    credits: 3,
    department: code.split("-", 1)[0] || undefined,
    metadataSource: "fallback",
    metadataFallback: true,
  };
}

export async function hydrateCourses(
  codes: string[],
  cachedCourses: Iterable<Course>,
  lookup: CourseLookup,
): Promise<HydratedCourses> {
  const normalizedCodes = codes.map((code) => code.trim().toUpperCase());
  const uniqueCodes = [...new Set(normalizedCodes)];
  const cached = new Map(
    [...cachedCourses].map((course) => {
      const normalized = normalizeCourse(course);
      return [normalized.code, normalized];
    }),
  );
  const courses = new Map<string, Course>();
  const cachedCodes: string[] = [];
  const fallbackCodes: string[] = [];

  await Promise.all(
    uniqueCodes.map(async (code) => {
      let freshCourse: Course | null = null;

      try {
        freshCourse = await lookup(code);
      } catch {
        freshCourse = null;
      }

      const cachedCourse = cached.get(code);
      const course = freshCourse
        ? {
            ...normalizeCourse(freshCourse),
            metadataSource: cachedCourse?.catalog
              ? "api+catalog" as const
              : "api" as const,
            catalog: cachedCourse?.catalog,
            requirements: cachedCourse?.requirements,
            availability: "api-available" as const,
          }
        : cachedCourse;

      if (course) {
        if (!freshCourse) {
          cachedCodes.push(code);
        }
        courses.set(code, course);
        return;
      }

      fallbackCodes.push(code);
      courses.set(code, fallbackCourse(code));
    }),
  );

  return {
    courses,
    cachedCodes: cachedCodes.sort(),
    fallbackCodes: fallbackCodes.sort(),
  };
}
