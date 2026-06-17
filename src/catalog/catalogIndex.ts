import type { CatalogIndexFile } from "../models/catalogCourse";
import { validateCatalogIndex } from "./normalize";

const CATALOG_INDEX_URL = "./catalog/catalog-index-2026.json";

let catalogIndexPromise: Promise<CatalogIndexFile> | null = null;

export async function loadCatalogIndex(
  fetchApi: typeof fetch = fetch,
): Promise<CatalogIndexFile> {
  catalogIndexPromise ??= fetchApi(CATALOG_INDEX_URL, {
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Catalog index returned status ${response.status}.`);
    }

    return validateCatalogIndex(await response.json());
  });

  return catalogIndexPromise;
}

export function resetCatalogIndexCache(): void {
  catalogIndexPromise = null;
}
