import type { JsonObject, JsonValue } from "./types";

const KEY_BYTES = new Uint8Array([
  78, 51, 108, 95, 90, 50, 57, 117, 104, 73, 113, 110, 103, 82, 37, 70, 89,
  112, 82, 52, 122, 33, 97, 125, 41, 36, 126, 58, 63, 73, 35, 51
]);

const IV_BYTES = new Uint8Array([
  90, 113, 42, 60, 67, 94, 112, 75, 87, 109, 107, 95, 92, 92, 107, 91
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

let cryptoKeyPromise: Promise<CryptoKey> | null = null;

async function getCryptoKey(): Promise<CryptoKey> {
  if (!cryptoKeyPromise) {
    cryptoKeyPromise = crypto.subtle.importKey(
      "raw",
      KEY_BYTES,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  return cryptoKeyPromise;
}

export function decodeBase64(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, "").trim();

  if (!normalized) {
    throw new Error("Input is empty.");
  }

  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new Error("Input is not valid Base64.");
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function decryptSave(bytes: Uint8Array): Promise<string> {
  try {
    const key = await getCryptoKey();
    const payload = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: IV_BYTES },
      key,
      payload as BufferSource,
    );

    return textDecoder.decode(new Uint8Array(decrypted));
  } catch {
    throw new Error("Decryption failed. Check that the save file is valid.");
  }
}

export async function encryptSave(minifiedJson: string): Promise<Uint8Array> {
  try {
    const key = await getCryptoKey();
    const payload = textEncoder.encode(minifiedJson);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: IV_BYTES },
      key,
      payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength,
      ) as BufferSource,
    );

    return new Uint8Array(encrypted);
  } catch {
    throw new Error("Encryption failed.");
  }
}

export function parseSaveJson(text: string): JsonObject {
  let parsed: JsonValue;

  try {
    parsed = JSON.parse(text) as JsonValue;
  } catch {
    throw new Error("Decrypted content is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected the save to contain a JSON object.");
  }

  return parsed;
}

export function serializeSaveJson(value: JsonValue): string {
  return JSON.stringify(value);
}

export function formatSaveJson(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}
