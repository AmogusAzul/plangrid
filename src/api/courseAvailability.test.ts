import { describe, expect, it, vi } from "vitest";
import {
  AVAILABILITY_CACHE_KEY,
  reconcileCatalogAvailability,
} from "./courseAvailability";
import type { CourseSearchResult } from "../models/searchResult";

function catalogResult(code: string): CourseSearchResult {
  return {
    code,
    name: "Catalog course",
    credits: 3,
    department: code.split("-", 1)[0],
    source: "catalog",
    metadataSource: "catalog",
    availability: "unknown",
  };
}

describe("course availability reconciliation", () => {
  it("marks API hits, catalog-only misses, and API failures", async () => {
    const storage = new Map<string, string>() as unknown as Storage;
    storage.getItem = vi.fn(() => null);
    storage.setItem = vi.fn();
    const lookup = vi.fn(async (code: string) => {
      if (code === "ISIS-1225") {
        return {
          code,
          name: "Fresh data structures",
          credits: 4,
          department: "ISIS",
        };
      }
      if (code === "DERE-3001") return null;
      throw new Error("offline");
    });

    const reconciled = await reconcileCatalogAvailability(
      [
        catalogResult("ISIS-1225"),
        catalogResult("DERE-3001"),
        catalogResult("BIOL-1001"),
      ],
      lookup,
      storage,
    );

    expect(reconciled.map((result) => result.availability)).toEqual([
      "api-available",
      "catalog-only",
      "unknown",
    ]);
    expect(reconciled[0]).toEqual(
      expect.objectContaining({
        name: "Fresh data structures",
        credits: 4,
        source: "api+catalog",
      }),
    );
  });

  it("uses the availability cache", async () => {
    const storage = new Map<string, string>() as unknown as Storage;
    storage.getItem = vi.fn((key: string) =>
      key === AVAILABILITY_CACHE_KEY
        ? JSON.stringify([
            {
              code: "ISIS-1225",
              term: "202620",
              status: "catalog-only",
              checkedAt: "2026-06-17T00:00:00.000Z",
            },
          ])
        : null,
    );
    storage.setItem = vi.fn();
    const lookup = vi.fn();

    const reconciled = await reconcileCatalogAvailability(
      [catalogResult("ISIS-1225")],
      lookup,
      storage,
    );

    expect(reconciled[0].availability).toBe("catalog-only");
    expect(lookup).not.toHaveBeenCalled();
  });
});
