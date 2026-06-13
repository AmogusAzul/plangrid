import { describe, expect, it } from "vitest";
import { createBlankPlan } from "./planFactory";
import { loadPlan, STORAGE_KEY } from "./planStorage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("planStorage", () => {
  it("adds grid slots when loading a legacy saved plan", () => {
    const storage = new MemoryStorage();
    const plan = createBlankPlan(1);
    plan.semesters[0].courses.push(
      {
        id: "course-1",
        code: "ISIS-1225",
        name: "Data Structures",
        credits: 3,
      },
      {
        id: "course-2",
        code: "MATE-1203",
        name: "Calculus",
        credits: 4,
      },
    );
    storage.setItem(STORAGE_KEY, JSON.stringify(plan));

    const loaded = loadPlan(storage);

    expect(
      loaded.semesters[0].courses.map((course) => course.slotStart),
    ).toEqual([1, 4]);
  });
});

