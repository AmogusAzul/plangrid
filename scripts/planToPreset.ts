import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Course } from "../src/models/course";
import { parsePlanFile } from "../src/export/csvExport";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function usage(): never {
  console.error(
    "Usage: npm run plan:preset -- input.plan output.json [preset-id] [description]",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const [, , inputPath, outputPath, explicitId, explicitDescription] =
    process.argv;
  if (!inputPath || !outputPath) usage();

  const parsed = parsePlanFile(await readFile(inputPath, "utf8"));
  const codes = [
    ...parsed.semesters.flatMap((semester) =>
      semester.courses.map((course) => course.code),
    ),
    ...parsed.storageCodes,
  ];
  const cachedCourses = new Map(
    parsed.cachedCourses.map((course) => [course.code, course]),
  );
  const courses: Course[] = [...new Set(codes)].map((code) => {
    const cached = cachedCourses.get(code);
    return cached ?? {
      code,
      name: code,
      credits: 3,
      department: code.split("-", 1)[0] || undefined,
      metadataSource: "fallback",
      metadataFallback: true,
    };
  });
  const preset = {
    id: explicitId || slugify(parsed.name || basename(inputPath, ".plan")),
    name: parsed.name,
    description:
      explicitDescription ||
      `Preset generated from ${basename(inputPath)}.`,
    creditLimitPerSemester: parsed.creditLimitPerSemester,
    courses,
    semesters: parsed.semesters.map((semester) => ({
      label: semester.label,
      termHint: semester.termHint,
      courseCodes: semester.courses.map((course) => course.code),
    })),
    storageCourseCodes: parsed.storageCodes,
    recognizedRequirementIds: parsed.recognizedRequirementIds,
  };

  await writeFile(outputPath, `${JSON.stringify(preset, null, 2)}\n`);
  console.log(`Wrote preset ${preset.id} to ${outputPath}.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
