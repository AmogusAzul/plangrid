import type { Course } from "../models/course";
import colorOverrideConfig from "../config/courseColorOverrides.json";

type ColorOverrideScheme = {
  id: string;
  name: string;
  enabled: boolean;
  departmentOverrides?: Record<string, string>;
  courseOverrides?: Record<string, string>;
};

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

export const colorOverrideSchemes = (
  colorOverrideConfig.schemes ?? []
) as ColorOverrideScheme[];

export const defaultColorOverrideSchemeIds = colorOverrideSchemes
  .filter((scheme) => scheme.enabled)
  .map((scheme) => scheme.id);

const LEVEL_LIGHTNESS = new Map([
  ["1", 48],
  ["2", 40],
  ["3", 32],
  ["4", 24],
]);

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function getCourseLevel(code: string): string | undefined {
  return /^[A-Z]+-(\d)/i.exec(code)?.[1];
}

function getCourseLightness(code: string): number {
  return LEVEL_LIGHTNESS.get(getCourseLevel(code) ?? "") ?? 36;
}

function parseHexColor(value: string): { red: number; green: number; blue: number } | null {
  const match = /^#?([a-f\d]{6})$/i.exec(value.trim());
  if (!match) return null;

  const hex = match[1];
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function hexToHueSaturation(value: string): { hue: number; saturation: number } | null {
  const color = parseHexColor(value);
  if (!color) return null;

  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { hue: 0, saturation: 0 };

  const saturation =
    delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return {
    hue: Math.round((hue + 360) % 360),
    saturation: Math.round(saturation * 100),
  };
}

function getOverrideColor(
  course: Course,
  enabledSchemeIds = defaultColorOverrideSchemeIds,
): string | undefined {
  const enabledIds = new Set(enabledSchemeIds);
  const code = normalizeKey(course.code);
  const department = normalizeKey(
    course.department ?? course.code.split("-")[0] ?? "PLAN",
  );

  for (const scheme of colorOverrideSchemes) {
    if (!enabledIds.has(scheme.id)) continue;

    const courseOverride = scheme.courseOverrides?.[code];
    if (courseOverride) return courseOverride;

    const departmentOverride = scheme.departmentOverrides?.[department];
    if (departmentOverride) return departmentOverride;
  }

  return undefined;
}

export function getCoursePalette(
  course: Course,
  enabledSchemeIds = defaultColorOverrideSchemeIds,
): CoursePalette {
  const department = course.department ?? course.code.split("-")[0] ?? "PLAN";
  const departmentHash = hashText(department);
  const overrideColor = getOverrideColor(course, enabledSchemeIds);
  const overrideHueSaturation = overrideColor
    ? hexToHueSaturation(overrideColor)
    : null;
  const hue = overrideHueSaturation?.hue ?? departmentHash % 256;
  const saturation = overrideHueSaturation?.saturation ?? 68;
  const lightness = getCourseLightness(course.code);

  return {
    background: `hsl(${hue} ${saturation}% ${lightness}%)`,
  };
}

export function getCourseColor(
  course: Course,
  enabledSchemeIds = defaultColorOverrideSchemeIds,
): string {
  return getCoursePalette(course, enabledSchemeIds).background;
}
