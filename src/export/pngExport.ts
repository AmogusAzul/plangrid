import { toPng } from "html-to-image";
import { downloadDataUrl, getFileName } from "./common";

type PngRenderer = typeof toPng;

export type PngExportDependencies = {
  render?: PngRenderer;
  download?: typeof downloadDataUrl;
  getStyle?: typeof getComputedStyle;
  date?: Date;
};

export async function exportPlanPNG(
  node: HTMLElement,
  planName: string,
  dependencies: PngExportDependencies = {},
): Promise<void> {
  const render = dependencies.render ?? toPng;
  const download = dependencies.download ?? downloadDataUrl;
  const getStyle = dependencies.getStyle ?? getComputedStyle;
  const computedStyle = getStyle(node);
  const width = node.scrollWidth;
  const height = node.scrollHeight;
  const backgroundColor =
    computedStyle.backgroundColor === "rgba(0, 0, 0, 0)"
      ? "#ffffff"
      : computedStyle.backgroundColor;

  const dataUrl = await render(node, {
    cacheBust: true,
    pixelRatio: 2,
    width,
    height,
    backgroundColor,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      maxHeight: "none",
      overflow: "visible",
      background: computedStyle.background,
    },
  });

  download(
    dataUrl,
    `${getFileName(planName, dependencies.date)}.png`,
  );
}
