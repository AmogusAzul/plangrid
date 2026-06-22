import { describe, expect, it, vi } from "vitest";
import { createBlankPlan } from "./planFactory";
import {
  applyCachedRequirements,
  COURSE_REQUIREMENTS_CACHE_KEY,
  refreshPlanRequirements,
} from "./planRequirements";

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>();
  if (initial) values.set(COURSE_REQUIREMENTS_CACHE_KEY, initial);
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("plan requirement cache", () => {
  it("applies cached checks immediately", () => {
    const storage = memoryStorage(
      JSON.stringify({
        "ISIS-1225": {
          status: "loaded",
          term: "202620",
          checkedAt: new Date().toISOString(),
          prerequisites: [],
          corequisites: [],
        },
      }),
    );
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push({
      id: "course",
      code: "ISIS-1225",
      name: "Data structures",
      credits: 3,
    });

    expect(
      applyCachedRequirements(plan, storage).semesters[0].courses[0]
        .requirements?.status,
    ).toBe("loaded");
  });

  it("reuses fresh checks and refreshes stale checks", async () => {
    const staleDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      .toISOString();
    const storage = memoryStorage(
      JSON.stringify({
        "ISIS-1225": {
          status: "not-offered",
          term: "202620",
          checkedAt: staleDate,
          prerequisites: [],
          corequisites: [],
        },
      }),
    );
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push({
      id: "course",
      code: "ISIS-1225",
      name: "Data structures",
      credits: 3,
    });
    const lookup = vi.fn(async () => ({
      status: "loaded" as const,
      term: "202620" as const,
      checkedAt: new Date().toISOString(),
      prerequisites: [],
      corequisites: [],
    }));

    const refreshed = await refreshPlanRequirements(
      plan,
      storage,
      lookup,
      new Set(["ISIS-1225"]),
    );

    expect(lookup).toHaveBeenCalledOnce();
    expect(refreshed.semesters[0].courses[0].requirements?.status).toBe(
      "loaded",
    );
  });
});
