import type { Course } from "../models/course";

function hashText(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export type CoursePalette = {
  background: string;
  foreground: "#ffffff" | "#172019";
};

export function getCoursePalette(course: Course): CoursePalette {
  const department = course.department ?? course.code.split("-")[0] ?? "PLAN";
  const courseNumber = course.code.split("-")[1] ?? course.code;
  const departmentHash = hashText(department);
  const courseHash = hashText(courseNumber);
  const hueOffset = (courseHash % 41) - 20;
  const hue = (departmentHash % 360 + hueOffset + 360) % 360;
  const saturation = 58 + ((departmentHash + courseHash) % 29);
  const lightnessStep = courseHash % 70;
  const lightness = Math.round(24 + (lightnessStep / 69) * 48);

  return {
    background: `hsl(${hue} ${saturation}% ${lightness}%)`,
    foreground: lightness >= 58 ? "#172019" : "#ffffff",
  };
}

export function getCourseColor(course: Course): string {
  return getCoursePalette(course).background;
}
