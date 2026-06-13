import { toPng } from 'html-to-image';

import { getFileName } from './common';

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function exportPlanPNG(rootClass : string, planName : string): Promise<void> {
    const node: HTMLElement = document.getElementsByClassName(rootClass).item(0) as HTMLElement;

    if (!(node instanceof HTMLElement)) {
    throw new Error(`Element with id "${rootClass}" was not found or is not an HTMLElement.`);
  }

  const computedStyle = getComputedStyle(node);

  const width = node.scrollWidth;
  const height = node.scrollHeight;

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    width,
    height,
    backgroundColor:
      computedStyle.backgroundColor === "rgba(0, 0, 0, 0)"
        ? "#ffffff"
        : computedStyle.backgroundColor,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      maxHeight: "none",
      overflow: "visible",
      background: computedStyle.background,
    },
  });

  downloadDataUrl(dataUrl, getFileName(planName)+".png");
}
