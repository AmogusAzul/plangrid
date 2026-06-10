import type { Course } from "../models/course";

function hashText(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function getCourseColor(course: Course): string {
  const department = course.department ?? course.code.split("-")[0] ?? "PLAN";
  const courseNumber = course.code.split("-")[1] ?? course.code;
  const hue = hashText(department) % 256;
  const lightness = 42 + (hashText(courseNumber) % 15);

  return `hsl(${hue} 68% ${lightness}%)`;
}

