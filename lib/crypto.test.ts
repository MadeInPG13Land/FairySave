import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64, parseSaveJson, serializeSaveJson } from "./crypto";

describe("base64 helpers", () => {
  it("encodes and decodes bytes", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = encodeBase64(bytes);
    expect(Array.from(decodeBase64(encoded))).toEqual(Array.from(bytes));
  });

  it("rejects malformed base64", () => {
    expect(() => decodeBase64("%%%")).toThrow("Input is not valid Base64.");
  });
});

describe("json helpers", () => {
  it("parses object payloads", () => {
    expect(parseSaveJson('{"ok":true}')).toEqual({ ok: true });
  });

  it("serializes to minified json", () => {
    expect(serializeSaveJson({ hello: "world", nested: { value: 1 } })).toBe(
      '{"hello":"world","nested":{"value":1}}',
    );
  });
});
