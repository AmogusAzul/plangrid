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

      const course = freshCourse
        ? normalizeCourse(freshCourse)
        : cached.get(code);

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
