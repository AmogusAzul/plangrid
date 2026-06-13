import { describe, expect, it } from "vitest";
import { captureAppScroll, restoreAppScroll } from "./appScroll";

interface Scrollable {
  scrollTop: number;
  scrollLeft: number;
}

function fakeRoot(
  planner: Scrollable | null,
  sidebar: Scrollable | null,
): HTMLElement {
  return {
    querySelector(selector: string) {
      if (selector === ".planner") return planner;
      if (selector === ".sidebar") return sidebar;
      return null;
    },
  } as unknown as HTMLElement;
}

describe("app scroll position", () => {
  it("restores planner and sidebar offsets after the app DOM is replaced", () => {
    const oldRoot = fakeRoot(
      { scrollTop: 640, scrollLeft: 85 },
      { scrollTop: 210, scrollLeft: 0 },
    );
    const position = captureAppScroll(oldRoot);
    const newPlanner = { scrollTop: 0, scrollLeft: 0 };
    const newSidebar = { scrollTop: 0, scrollLeft: 0 };

    restoreAppScroll(fakeRoot(newPlanner, newSidebar), position);

    expect(newPlanner).toEqual({ scrollTop: 640, scrollLeft: 85 });
    expect(newSidebar.scrollTop).toBe(210);
  });

  it("uses zero offsets when the app has not rendered yet", () => {
    expect(captureAppScroll(fakeRoot(null, null))).toEqual({
      plannerTop: 0,
      plannerLeft: 0,
      sidebarTop: 0,
    });
  });
});
