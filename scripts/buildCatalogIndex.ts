import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  CatalogCourse,
  CatalogIndexFile,
} from "../src/models/catalogCourse";
import {
  compactWhitespace,
  departmentFromCode,
  normalizeCourseCode,
  normalizeSearchText,
} from "../src/catalog/normalize";

const SOURCE_URL = "https://uniandes.smartcatalogiq.com/es-es/2026/catalogo/";
const COURSES_URL = `${SOURCE_URL}courses`;
const OUTPUT_PATH = "public/catalog/catalog-index-2026.json";
const HOST = "https://uniandes.smartcatalogiq.com";
const CONCURRENCY = 8;

type DepartmentLink = {
  url: string;
  code: string;
  name?: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/&uuml;/g, "ü")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return compactWhitespace(
    decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")),
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "PlanGrid catalog indexer" },
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.text();
}

async function mapConcurrent<T, R>(
  items: T[],
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker),
  );
  return results;
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${HOST}${path}`;
}

function parseDepartmentLinks(html: string): DepartmentLink[] {
  const links = new Map<string, DepartmentLink>();
  const pattern =
    /href="([^"]*\/es-es\/2026\/catalogo\/courses\/([^"/]+))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const url = absoluteUrl(match[1]);
    const code = decodeHtml(match[2]).toUpperCase();
    const label = stripTags(match[3]);
    const name = label.includes(" - ")
      ? label.split(" - ").slice(1).join(" - ")
      : undefined;

    links.set(url, { url, code, name });
  }

  return [...links.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function parseBucketLinks(html: string, departmentUrl: string): string[] {
  const base = new URL(departmentUrl);
  const escaped = base.pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`href="([^"]*${escaped}/([^"/]+))"`, "gi");
  const links = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    const segment = decodeHtml(match[2]).toLowerCase();
    if (/^[a-z]{3,5}-?\d/i.test(segment)) continue;
    links.add(absoluteUrl(match[1]));
  }

  return [...links];
}

function parseCoursesFromPage(
  html: string,
  department: DepartmentLink,
): CatalogCourse[] {
  const courses: CatalogCourse[] = [];
  const blockPattern =
    /<h2>\s*<a href="([^"]+)"><span>([^<]+)<\/span>\s*([\s\S]*?)<\/a>\s*<\/h2>([\s\S]*?)(?=<h2>|<\/div>\s*<!--\s*end main|Universidad de los Andes \|)/gi;

  for (const match of html.matchAll(blockPattern)) {
    const code = normalizeCourseCode(stripTags(match[2]));
    if (!/^[A-Z]{3,5}-[0-9]/.test(code)) continue;

    const title = stripTags(match[3])
      .replace(new RegExp(`^${code.replace("-", "")}\\s*`, "i"), "")
      .trim();
    const block = match[4];
    const descriptionMatch = /<div class="desc">([\s\S]*?)<\/div>/i.exec(block);
    const creditsMatch = /<div class="credits">\s*([\s\S]*?)\s*<\/div>/i.exec(block);
    const description = descriptionMatch
      ? stripTags(descriptionMatch[1])
      : "";
    const creditsText = creditsMatch ? stripTags(creditsMatch[1]) : "";
    const credits = /^-?\d+(\.\d+)?$/.test(creditsText)
      ? Number(creditsText)
      : null;
    const courseTitle = title || stripTags(match[3]) || code;
    const departmentCode = departmentFromCode(code);

    courses.push({
      code,
      normalizedCode: code,
      title: courseTitle,
      credits,
      departmentCode,
      departmentName: department.name,
      description,
      catalogUrl: absoluteUrl(match[1]),
      catalogYear: "2026",
      source: "smartcatalog",
      searchableText: normalizeSearchText(
        `${code} ${departmentCode} ${courseTitle} ${department.name ?? ""} ${description}`,
      ),
    });
  }

  return courses;
}

function validateGeneratedIndex(index: CatalogIndexFile): void {
  if (index.courses.length < 1000) {
    throw new Error(
      `Catalog index looks too small: ${index.courses.length} courses.`,
    );
  }

  const malformed = index.courses.find(
    (course) =>
      !course.code ||
      !course.title ||
      !course.departmentCode ||
      !course.searchableText,
  );
  if (malformed) {
    throw new Error(`Malformed catalog course: ${malformed.code}`);
  }
}

async function main(): Promise<void> {
  const rootHtml = await fetchText(COURSES_URL);
  const departments = parseDepartmentLinks(rootHtml);
  console.log(`Found ${departments.length} departments.`);

  const departmentPages = await mapConcurrent(departments, async (department) => {
    const html = await fetchText(department.url);
    const bucketLinks = parseBucketLinks(html, department.url);
    return { department, bucketLinks };
  });
  const buckets = departmentPages.flatMap(({ department, bucketLinks }) =>
    bucketLinks.map((url) => ({ department, url })),
  );
  console.log(`Found ${buckets.length} course pages.`);

  const coursesByCode = new Map<string, CatalogCourse>();
  const pageCourses = await mapConcurrent(buckets, async ({ department, url }) =>
    parseCoursesFromPage(await fetchText(url), department),
  );

  for (const course of pageCourses.flat()) {
    const existing = coursesByCode.get(course.code);
    if (!existing || course.description.length > existing.description.length) {
      coursesByCode.set(course.code, course);
    }
  }

  const index: CatalogIndexFile = {
    version: 1,
    catalogYear: "2026",
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    courses: [...coursesByCode.values()].sort((left, right) =>
      left.code.localeCompare(right.code),
    ),
  };
  validateGeneratedIndex(index);

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Wrote ${index.courses.length} courses to ${OUTPUT_PATH}.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
