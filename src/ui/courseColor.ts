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

const paletteCache = new Map<string, CoursePalette>();

function secureRandomUnit(): number {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 2 ** 32;
  }

  return Math.random();
}

export function clearCoursePaletteCache(): void {
  paletteCache.clear();
}

export function getCoursePalette(
  course: Course,
  randomUnit = secureRandomUnit,
): CoursePalette {
  const cachedPalette = paletteCache.get(course.code);
  if (cachedPalette) return cachedPalette;

  const department = course.department ?? course.code.split("-")[0] ?? "PLAN";
  const courseNumber = course.code.split("-")[1] ?? course.code;
  const departmentHash = hashText(department);
  const courseHash = hashText(courseNumber);
  const hueOffset = (courseHash % 41) - 20;
  const hue = (departmentHash % 360 + hueOffset + 360) % 360;
  const saturation = 58 + ((departmentHash + courseHash) % 29);
  const randomValue = Math.min(1, Math.max(0, randomUnit()));
  const lightness = Math.round(24 + randomValue * 48);

  const palette: CoursePalette = {
    background: `hsl(${hue} ${saturation}% ${lightness}%)`,
    foreground: lightness >= 58 ? "#172019" : "#ffffff",
  };

  paletteCache.set(course.code, palette);
  return palette;
}

export function getCourseColor(course: Course): string {
  return getCoursePalette(course).background;
}
