import type {
  AppSection,
  JsonObject,
  JsonValue,
  ValidationIssue,
  WorldSaveDraft
} from "./types";

export function detectSection(data: JsonObject): AppSection {
  if ("characterName" in data || "rankLevel" in data) {
    return "player";
  }

  if ("gamemode" in data || "credits" in data || "worldData" in data) {
    return "world";
  }

  return "json";
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function updateField(
  data: JsonObject,
  key: string,
  value: JsonValue,
): JsonObject {
  return { ...data, [key]: value };
}

export function updateNestedField(
  data: JsonObject,
  path: string[],
  value: JsonValue,
): JsonObject {
  const clone = deepClone(data);
  let current: JsonObject = clone;

  for (let index = 0; index < path.length - 1; index += 1) {
    const nextValue = current[path[index]];

    if (!nextValue || typeof nextValue !== "object" || Array.isArray(nextValue)) {
      current[path[index]] = {};
    }

    current = current[path[index]] as JsonObject;
  }

  current[path[path.length - 1]] = value;
  return clone;
}

export function validateData(section: AppSection, data: JsonObject | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!data) {
    issues.push({
      id: "missing-data",
      level: "error",
      message: "No decrypted save data is loaded."
    });
    return issues;
  }

  if (section === "player") {
    if (typeof data.characterName !== "string" || data.characterName.trim() === "") {
      issues.push({
        id: "character-name",
        level: "error",
        message: "Character name is required."
      });
    }

    if (typeof data.rankLevel !== "number") {
      issues.push({
        id: "rank-level",
        level: "error",
        message: "Rank level must be a number."
      });
    }
  }

  if (section === "world") {
    const world = data as WorldSaveDraft;
    if (typeof world.credits !== "number") {
      issues.push({
        id: "credits",
        level: "error",
        message: "Credits must be a number."
      });
    }

    if (!world.worldData || typeof world.worldData !== "object") {
      issues.push({
        id: "world-data",
        level: "error",
        message: "World metadata is missing."
      });
    }
  }

  try {
    JSON.stringify(data);
  } catch {
    issues.push({
      id: "serialize",
      level: "error",
      message: "The current save data cannot be serialized."
    });
  }

  return issues;
}
