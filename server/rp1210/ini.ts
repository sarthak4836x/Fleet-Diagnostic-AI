import * as fs from 'fs';
import * as path from 'path';

export type IniData = Record<string, Record<string, string>>;

/** Minimal INI parser: [section], key=value, ';' comment lines. Section/key names are lowercased. */
export function parseIni(text: string): IniData {
  const out: IniData = {};
  let cur = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      cur = sec[1].trim().toLowerCase();
      out[cur] ??= {};
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0 || !cur) continue;
    out[cur][line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim();
  }
  return out;
}

export interface DeviceInfo { id: number; deviceId: number; name: string; description: string }
export interface ProtocolInfo { id: number; protocolString: string; description: string; speed: string[] }
export interface VendorInfo {
  vendorId: string;
  name: string;
  rp1210Revision: string;
  autoDetectCapable: boolean;
  protocols: number[];
  devices: number[];
  deviceInfos: DeviceInfo[];
  protocolInfos: ProtocolInfo[];
}

const nums = (s: string | undefined): number[] =>
  (s ?? '').split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));

export function listVendors(windowsDir = 'C:\\Windows'): string[] {
  const ini = parseIni(fs.readFileSync(path.join(windowsDir, 'RP121032.ini'), 'latin1'));
  return (ini['rp1210support']?.['apiimplementations'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function readVendorIni(vendorId: string, windowsDir = 'C:\\Windows'): VendorInfo {
  const ini = parseIni(fs.readFileSync(path.join(windowsDir, vendorId + '.ini'), 'latin1'));
  const v = ini['vendorinformation'] ?? {};
  const numbered = (prefix: string) =>
    Object.keys(ini)
      .map((k) => ({ k, m: new RegExp(`^${prefix}(\\d+)$`).exec(k) }))
      .filter((x) => x.m)
      .map((x) => ({ n: Number(x.m![1]), s: ini[x.k] }))
      .sort((a, b) => a.n - b.n);
  return {
    vendorId,
    name: v['name'] ?? '',
    rp1210Revision: v['rp1210'] ?? '',
    autoDetectCapable: /^(yes|true|1)$/i.test(v['autodetectcapable'] ?? ''),
    protocols: nums(v['protocols']),
    devices: nums(v['devices']),
    deviceInfos: numbered('deviceinformation').map(({ n, s }) => ({
      id: n,
      deviceId: Number(s['deviceid']),
      name: s['devicename'] ?? '',
      description: s['devicedescription'] ?? '',
    })),
    protocolInfos: numbered('protocolinformation').map(({ n, s }) => ({
      id: n,
      protocolString: s['protocolstring'] ?? '',
      description: s['protocoldescription'] ?? '',
      speed: (s['protocolspeed'] ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    })),
  };
}
