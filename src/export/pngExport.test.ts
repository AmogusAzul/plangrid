import { describe, expect, it, vi } from "vitest";
import { exportPlanPNG } from "./pngExport";

function plannerElement(width = 1200, height = 900): HTMLElement {
  return {
    scrollWidth: width,
    scrollHeight: height,
  } as HTMLElement;
}

function style(
  backgroundColor = "rgba(0, 0, 0, 0)",
  background = "",
): CSSStyleDeclaration {
  return {
    backgroundColor,
    background,
  } as CSSStyleDeclaration;
}

describe("exportPlanPNG", () => {
  it("renders the full scroll area and downloads a sanitized dated file", async () => {
    const node = plannerElement(1440, 1080);
    const render = vi.fn(async () => "data:image/png;base64,plan");
    const download = vi.fn();

    await exportPlanPNG(node, "Mi Plan Físico!", {
      render,
      download,
      getStyle: () => style("rgba(0, 0, 0, 0)", "transparent"),
      date: new Date(2026, 5, 13),
    });

    expect(render).toHaveBeenCalledWith(
      node,
      expect.objectContaining({
        width: 1440,
        height: 1080,
        backgroundColor: "#ffffff",
        style: expect.objectContaining({
          width: "1440px",
          height: "1080px",
          maxHeight: "none",
          overflow: "visible",
        }),
      }),
    );
    expect(download).toHaveBeenCalledWith(
      "data:image/png;base64,plan",
      "mi-plan-fisico-2026-06-13.png",
    );
  });

  it("keeps a non-transparent planner background", async () => {
    const render = vi.fn(async () => "data:image/png;base64,plan");

    await exportPlanPNG(plannerElement(), "Plan", {
      render,
      download: vi.fn(),
      getStyle: () => style("rgb(246, 248, 244)"),
    });

    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        backgroundColor: "rgb(246, 248, 244)",
      }),
    );
  });

  it("propagates renderer failures without downloading", async () => {
    const failure = new Error("canvas failed");
    const download = vi.fn();

    await expect(
      exportPlanPNG(plannerElement(), "Plan", {
        render: vi.fn(async () => {
          throw failure;
        }),
        download,
        getStyle: () => style(),
      }),
    ).rejects.toBe(failure);
    expect(download).not.toHaveBeenCalled();
  });
});
