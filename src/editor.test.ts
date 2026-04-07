import { describe, expect, it } from "vitest";
import { detectSection, validateData } from "./editor";

describe("editor helpers", () => {
  it("detects player saves", () => {
    expect(detectSection({ characterName: "Matt" })).toBe("player");
  });

  it("detects world saves", () => {
    expect(detectSection({ credits: 100 })).toBe("world");
  });

  it("validates required player fields", () => {
    const issues = validateData("player", { rankLevel: 1 });
    expect(issues.some((issue) => issue.id === "character-name")).toBe(true);
  });
});
