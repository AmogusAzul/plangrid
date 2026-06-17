import { describe, expect, it, vi } from "vitest";
import type { Course } from "../models/course";
import { hydrateCourses } from "./courseHydration";

const cached: Course = {
  code: "ISIS-1221",
  name: "Cached programming",
  credits: 3,
  department: "ISIS",
};

describe("hydrateCourses", () => {
  it("prefers fresh metadata when lookup succeeds", async () => {
    const fresh = { ...cached, name: "Fresh programming", credits: 4 };

    const hydrated = await hydrateCourses(
      [cached.code],
      [cached],
      async () => fresh,
    );

    expect(hydrated.courses.get(cached.code)).toEqual(
      expect.objectContaining({
        ...fresh,
        metadataSource: "api",
        availability: "api-available",
      }),
    );
    expect(hydrated.cachedCodes).toEqual([]);
    expect(hydrated.fallbackCodes).toEqual([]);
  });

  it("uses cached metadata when lookup is missing or fails", async () => {
    const missing = await hydrateCourses(
      [cached.code],
      [cached],
      async () => null,
    );
    const failed = await hydrateCourses(
      [cached.code],
      [cached],
      async () => {
        throw new Error("offline");
      },
    );

    expect(missing.courses.get(cached.code)).toEqual(cached);
    expect(failed.courses.get(cached.code)).toEqual(cached);
    expect(missing.cachedCodes).toEqual([cached.code]);
    expect(failed.cachedCodes).toEqual([cached.code]);
    expect(missing.fallbackCodes).toEqual([]);
    expect(failed.fallbackCodes).toEqual([]);
  });

  it("fetches unique codes once and synthesizes only uncached misses", async () => {
    const lookup = vi.fn(async () => null);

    const hydrated = await hydrateCourses(
      ["UNKNOWN-1000", "UNKNOWN-1000"],
      [],
      lookup,
    );

    expect(lookup).toHaveBeenCalledOnce();
    expect(hydrated.fallbackCodes).toEqual(["UNKNOWN-1000"]);
    expect(hydrated.courses.get("UNKNOWN-1000")).toEqual(
      expect.objectContaining({ credits: 3 }),
    );
  });
});
