export type RecognizedRequirementId =
  | "homologated-precalculus"
  | "foreign-language-requirement";

export type RecognizedRequirementDefinition = {
  id: RecognizedRequirementId;
  label: string;
  description: string;
  satisfiedCodes: string[];
};

export const recognizedRequirementDefinitions: RecognizedRequirementDefinition[] =
  [
    {
      id: "homologated-precalculus",
      label: "Homologated precalculus",
      description:
        "Counts MATE-1201, MATE1, and MATS1 as already fulfilled.",
      satisfiedCodes: ["MATE-1201", "MATE-1", "MATS-1"],
    },
    {
      id: "foreign-language-requirement",
      label: "Foreign-language requirement fulfilled",
      description:
        "Counts the common Uniandes language-requirement aliases as fulfilled.",
      satisfiedCodes: [
        "ENGL-7",
        "INGL-4",
        "INLE-4",
        "INLE-5",
        "RLEC-1",
        "RLEN-1",
      ],
    },
  ];

export const recognizedRequirementAliasCodes = new Set([
  "MATE-1",
  "MATS-1",
  "ENGL-7",
  "INGL-4",
  "INLE-4",
  "INLE-5",
  "RLEC-1",
  "RLEN-1",
]);

export function recognizedRequirementCodes(
  ids: readonly RecognizedRequirementId[],
): Set<string> {
  const selected = new Set(ids);
  return new Set(
    recognizedRequirementDefinitions
      .filter((definition) => selected.has(definition.id))
      .flatMap((definition) => definition.satisfiedCodes),
  );
}
