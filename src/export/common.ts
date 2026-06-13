export function getFileName(
  planName: string,
  date = new Date(),
): string {
  const safeName = planName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "plangrid-plan";
  const dateText = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return `${safeName}-${dateText}`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function downloadTextFile(
  text: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));

  try {
    downloadDataUrl(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
