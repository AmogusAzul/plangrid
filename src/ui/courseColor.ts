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
};

function seededRandomUnit(seed: string): number {
  let state = hashText(seed) + 0x6d2b79f5;
  state = Math.imul(state ^ (state >>> 15), state | 1);
  state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
  return ((state ^ (state >>> 14)) >>> 0) / 2 ** 32;
}

export function getCoursePalette(course: Course): CoursePalette {
  const department = course.department ?? course.code.split("-")[0] ?? "PLAN";
  const departmentHash = hashText(department);
  const hue = departmentHash % 256;
  const saturation = 68;
  const lightness = Math.round(22 + seededRandomUnit(course.code) * 26);

  return {
    background: `hsl(${hue} ${saturation}% ${lightness}%)`,
  };
}

export function getCourseColor(course: Course): string {
  return getCoursePalette(course).background;
}
