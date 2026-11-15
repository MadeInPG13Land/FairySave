import { describe, expect, it } from 'vitest';
import { buildRegFile, decodeRegBytes, parseRegExport, regNameFor, unityHash } from './registry';

const EXPORT = [
  'Windows Registry Editor Version 5.00',
  '',
  '[HKEY_CURRENT_USER\\Software\\made in fairyland\\Forsaken Frontiers]',
  '"FlavorIndex_h2996959227"=dword:0000000b',
  '"Gamma_h207728930"=hex(4):00,00,00,00,00,00,f0,3f',
  '"SelectedResolution_h1589481762"=hex:31,39,32,30,78,31,30,38,30,00',
  '"crouchbind_h2402776740"=hex:4b,65,79,62,6f,61,72,64,2f,\\',
  '  43,74,72,6c,00',
  '',
  '[HKEY_CURRENT_USER\\Software\\Some Other Game]',
  '"FlavorIndex_h2996959227"=dword:00000001',
  '',
].join('\r\n');

function utf16(text: string): ArrayBuffer {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set([0xff, 0xfe]);
  for (let i = 0; i < text.length; i += 1) {
    bytes[2 + i * 2] = text.charCodeAt(i) & 0xff;
    bytes[3 + i * 2] = text.charCodeAt(i) >> 8;
  }
  return bytes.buffer;
}

describe('registry', () => {
  it('hashes names the way Unity does', () => {
    expect(unityHash('FlavorIndex')).toBe(2996959227);
    expect(regNameFor('Gamma')).toBe('Gamma_h207728930');
  });

  it('reads a UTF-16 export: numbers, decimals, wrapped text, only the game key', () => {
    const entries = parseRegExport(decodeRegBytes(utf16(EXPORT)));
    expect(entries.FlavorIndex).toEqual({ regName: 'FlavorIndex_h2996959227', type: 'dword', value: 11 });
    expect(entries.Gamma).toEqual({ regName: 'Gamma_h207728930', type: 'double', value: 1 });
    expect(entries.SelectedResolution.value).toBe('1920x1080');
    expect(entries.crouchbind.value).toBe('Keyboard/Ctrl');
    expect(Object.keys(entries)).toHaveLength(4);
  });

  it('refuses files without the game key', () => {
    expect(() => parseRegExport('Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\Other]\r\n')).toThrow(/Forsaken Frontiers/);
    expect(() => parseRegExport('hello')).toThrow(/registry export/);
  });

  it('writes values back in the same encodings', () => {
    const file = buildRegFile([
      { regName: 'FlavorIndex_h2996959227', type: 'dword', value: 3 },
      { regName: 'Gamma_h207728930', type: 'double', value: 0.75 },
      { regName: 'crouchbind_h2402776740', type: 'string', value: 'Keyboard/C' },
      { regName: 'Old_h1', type: 'dword', value: null },
    ]);
    const text = decodeRegBytes(file.buffer as ArrayBuffer);
    expect(text).toContain('"FlavorIndex_h2996959227"=dword:00000003');
    expect(text).toContain('"Old_h1"=-');
    const back = parseRegExport(text);
    expect(back.Gamma.value).toBe(0.75);
    expect(back.crouchbind.value).toBe('Keyboard/C');
    expect(text.split('\r\n')[0]).toBe('Windows Registry Editor Version 5.00');
  });
});
