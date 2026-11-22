/**
 * Expert Automotive Telematics Decoder Engine
 * Translates raw ECU data streams (OBD-II Mode 01/03/07 and SAE J1939 CAN frames)
 * into structured, standardized JSON telemetry for fleet management backends.
 */

export interface DecodedTelematicsOutput {
  timestamp_processed: string;
  telemetry_metrics: {
    engine_rpm: number | null;
    vehicle_speed_kmh: number | null;
    coolant_temp_celsius: number | null;
    throttle_position_percent: number | null;
    engine_load_percent?: number | null;
    intake_air_temp_celsius?: number | null;
    fuel_level_percent?: number | null;
    barometric_pressure_kpa?: number | null;
  };
  diagnostic_trouble_codes: string[];
  raw_payload: string;
  decoding_errors: string[];
}

/**
 * Standard OBD-II Mode 01 PID formulas (SAE J1979)
 */
export const OBD_PID_METRICS = {
  '04': { name: 'Engine Load', unit: '%', decode: (a: number) => Math.round(((a * 100) / 255) * 10) / 10 },
  '05': { name: 'Coolant Temperature', unit: '°C', decode: (a: number) => a - 40 },
  '0C': { name: 'Engine RPM', unit: 'RPM', decode: (a: number, b: number) => Math.round(((a * 256) + b) / 4) },
  '0D': { name: 'Vehicle Speed', unit: 'km/h', decode: (a: number) => a },
  '0F': { name: 'Intake Air Temperature', unit: '°C', decode: (a: number) => a - 40 },
  '11': { name: 'Throttle Position', unit: '%', decode: (a: number) => Math.round(((a * 100) / 255) * 10) / 10 },
  '2F': { name: 'Fuel Tank Level', unit: '%', decode: (a: number) => Math.round(((a * 100) / 255) * 10) / 10 },
  '33': { name: 'Barometric Pressure', unit: 'kPa', decode: (a: number) => a },
};

/**
 * Decodes a 2-byte hex pair into a standard alphanumeric Diagnostic Trouble Code (DTC)
 * Format per SAE J1979 / ISO 15031-6:
 * Byte A:
 *   Bits 7-6: System Prefix (00=P Powertrain, 01=C Chassis, 10=B Body, 11=U Network)
 *   Bits 5-4: Code Type (0, 1, 2, 3)
 *   Bits 3-0: Second digit (Hex)
 * Byte B:
 *   Bits 7-4: Third digit (Hex)
 *   Bits 3-0: Fourth digit (Hex)
 */
export function decodeDtcBytePair(byteA: number, byteB: number): string | null {
  if (byteA === 0 && byteB === 0) return null; // No fault code in this slot

  const prefixBits = (byteA >> 6) & 0x03;
  let prefix = 'P';
  if (prefixBits === 1) prefix = 'C';
  else if (prefixBits === 2) prefix = 'B';
  else if (prefixBits === 3) prefix = 'U';

  const typeBit = (byteA >> 4) & 0x03;
  const secondHex = (byteA & 0x0F).toString(16).toUpperCase();
  const thirdHex = ((byteB >> 4) & 0x0F).toString(16).toUpperCase();
  const fourthHex = (byteB & 0x0F).toString(16).toUpperCase();

  return `${prefix}${typeBit}${secondHex}${thirdHex}${fourthHex}`;
}

/**
 * Cleans and tokenizes raw string input into hexadecimal bytes
 */
export function extractHexTokens(input: string): string[] {
  // Remove common prefix descriptors if present (e.g. "Mode 01 PID 0C response:")
  const cleaned = input
    .replace(/Mode\s+[0-9A-Fa-f]+/gi, ' ')
    .replace(/PID\s+[0-9A-Fa-f]+/gi, ' ')
    .replace(/response\s*:/gi, ' ')
    .replace(/CAN_ID\s*:\s*[0-9A-Fa-f]+/gi, ' ')
    .replace(/[^0-9A-Fa-f\s]/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Match 2-character hex pairs
  const tokens = cleaned.match(/[0-9A-Fa-f]{2}/g) || [];
  return tokens.map(t => t.toUpperCase());
}

/**
 * Main Expert Automotive Telematics Decoder function
 * Processes raw strings containing OBD-II responses or CAN frames
 */
export function decodeRawTelematicsPayload(rawPayload: string): DecodedTelematicsOutput {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  const dtcList: string[] = [];

  const metrics: DecodedTelematicsOutput['telemetry_metrics'] = {
    engine_rpm: null,
    vehicle_speed_kmh: null,
    coolant_temp_celsius: null,
    throttle_position_percent: null,
    engine_load_percent: null,
    intake_air_temp_celsius: null,
    fuel_level_percent: null,
    barometric_pressure_kpa: null,
  };

  if (!rawPayload || typeof rawPayload !== 'string' || !rawPayload.trim()) {
    return {
      timestamp_processed: timestamp,
      telemetry_metrics: metrics,
      diagnostic_trouble_codes: [],
      raw_payload: rawPayload || '',
      decoding_errors: ['Empty or invalid payload received'],
    };
  }

  // Handle multi-line streams or comma/semicolon delimited frames
  const lines = rawPayload.split(/[\r\n;,]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const tokens = extractHexTokens(line);

    if (tokens.length === 0) {
      errors.push(`Malformed or unrecognized non-hexadecimal frame: "${line}"`);
      continue;
    }

    let i = 0;
    while (i < tokens.length) {
      const byte0 = tokens[i];

      // Standard OBD-II Mode 01 Response starts with 41
      if (byte0 === '41') {
        if (i + 1 >= tokens.length) {
          errors.push(`Truncated Mode 01 response: missing PID after 41`);
          break;
        }

        const pid = tokens[i + 1];

        // PID 0C: Engine RPM (Requires 2 data bytes: A, B)
        if (pid === '0C') {
          if (i + 3 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 0C payload: expected 2 data bytes (A, B)`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          const byteB = parseInt(tokens[i + 3], 16);
          if (isNaN(byteA) || isNaN(byteB)) {
            errors.push(`Invalid hex bytes for RPM: "${tokens[i + 2]} ${tokens[i + 3]}"`);
          } else {
            metrics.engine_rpm = Math.round(((byteA * 256) + byteB) / 4);
          }
          i += 4;
          continue;
        }

        // PID 05: Coolant Temp (Requires 1 data byte: A - 40)
        if (pid === '05') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 05 payload: expected 1 data byte`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (isNaN(byteA)) {
            errors.push(`Invalid hex byte for Coolant Temp: "${tokens[i + 2]}"`);
          } else {
            metrics.coolant_temp_celsius = byteA - 40;
          }
          i += 3;
          continue;
        }

        // PID 0D: Vehicle Speed (Requires 1 data byte: A)
        if (pid === '0D') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 0D payload: expected 1 data byte`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (isNaN(byteA)) {
            errors.push(`Invalid hex byte for Vehicle Speed: "${tokens[i + 2]}"`);
          } else {
            metrics.vehicle_speed_kmh = byteA;
          }
          i += 3;
          continue;
        }

        // PID 11: Throttle Position (Requires 1 data byte: (A * 100) / 255)
        if (pid === '11') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 11 payload: expected 1 data byte`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (isNaN(byteA)) {
            errors.push(`Invalid hex byte for Throttle Position: "${tokens[i + 2]}"`);
          } else {
            metrics.throttle_position_percent = Math.round(((byteA * 100) / 255) * 10) / 10;
          }
          i += 3;
          continue;
        }

        // PID 04: Calculated Engine Load (Requires 1 data byte: (A * 100) / 255)
        if (pid === '04') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 04 payload: expected 1 data byte`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (!isNaN(byteA)) {
            metrics.engine_load_percent = Math.round(((byteA * 100) / 255) * 10) / 10;
          }
          i += 3;
          continue;
        }

        // PID 0F: Intake Air Temp (A - 40)
        if (pid === '0F') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 0F payload`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (!isNaN(byteA)) {
            metrics.intake_air_temp_celsius = byteA - 40;
          }
          i += 3;
          continue;
        }

        // PID 2F: Fuel Tank Level ((A * 100) / 255)
        if (pid === '2F') {
          if (i + 2 >= tokens.length) {
            errors.push(`Incomplete Mode 01 PID 2F payload`);
            break;
          }
          const byteA = parseInt(tokens[i + 2], 16);
          if (!isNaN(byteA)) {
            metrics.fuel_level_percent = Math.round(((byteA * 100) / 255) * 10) / 10;
          }
          i += 3;
          continue;
        }

        // Other PIDs
        errors.push(`Unsupported or unmapped Mode 01 PID: 0x${pid}`);
        i += 2;
        continue;
      }

      // Mode 03 (Confirmed DTCs) response starts with 43
      // Mode 07 (Pending DTCs) response starts with 47
      if (byte0 === '43' || byte0 === '47') {
        let ptr = i + 1;
        while (ptr + 1 < tokens.length) {
          // If next byte is another response header, break
          if (tokens[ptr] === '41' || tokens[ptr] === '43' || tokens[ptr] === '47') break;

          const byteA = parseInt(tokens[ptr], 16);
          const byteB = parseInt(tokens[ptr + 1], 16);

          if (!isNaN(byteA) && !isNaN(byteB)) {
            const dtc = decodeDtcBytePair(byteA, byteB);
            if (dtc && !dtcList.includes(dtc)) {
              dtcList.push(dtc);
            }
          }
          ptr += 2;
        }
        i = ptr;
        continue;
      }

      // If user provided a direct raw byte pair or unformatted DTC string (e.g., "P0300" in text)
      const dtcMatch = line.match(/\b([PCBU][0-3][0-9A-Fa-f]{3})\b/gi);
      if (dtcMatch) {
        for (const code of dtcMatch) {
          const upper = code.toUpperCase();
          if (!dtcList.includes(upper)) {
            dtcList.push(upper);
          }
        }
      }

      // Advance to next token if not matched
      i++;
    }
  }

  return {
    timestamp_processed: timestamp,
    telemetry_metrics: metrics,
    diagnostic_trouble_codes: dtcList,
    raw_payload: rawPayload,
    decoding_errors: errors,
  };
}

/**
 * Encodes a standard alphanumeric DTC (e.g., "P0171", "U0100") into 2-byte hex pair (e.g. "01 71")
 */
export function encodeDtcToHex(dtc: string): string | null {
  if (!dtc || typeof dtc !== 'string') return null;
  const match = dtc.trim().toUpperCase().match(/^([PCBU])([0-3])([0-9A-F])([0-9A-F])([0-9A-F])$/);
  if (!match) return null;

  const [, prefixChar, typeChar, d2, d3, d4] = match;
  let prefixBits = 0;
  if (prefixChar === 'C') prefixBits = 1;
  else if (prefixChar === 'B') prefixBits = 2;
  else if (prefixChar === 'U') prefixBits = 3;

  const typeBits = parseInt(typeChar, 10) & 0x03;
  const secondVal = parseInt(d2, 16);
  const thirdVal = parseInt(d3, 16);
  const fourthVal = parseInt(d4, 16);

  const byteA = (prefixBits << 6) | (typeBits << 4) | secondVal;
  const byteB = (thirdVal << 4) | fourthVal;

  return `${byteA.toString(16).padStart(2, '0').toUpperCase()} ${byteB.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * Generates authentic OBD-II Mode 01 & Mode 03 hexadecimal strings from vehicle telemetry
 */
export function generateSimulatedObdHex(telemetry: {
  engine_rpm?: number | null;
  speed_kmh?: number | null;
  coolant_temp_c?: number | null;
  engine_load_pct?: number | null;
  active_dtc_codes?: string[];
}): string {
  const lines: string[] = [];

  // PID 0C: Engine RPM ((A * 256) + B) / 4
  const rpm = Math.max(0, Math.round(telemetry.engine_rpm ?? 1400));
  const rawRpmVal = Math.min(65535, rpm * 4);
  const rpmA = Math.floor(rawRpmVal / 256)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  const rpmB = (rawRpmVal % 256).toString(16).padStart(2, '0').toUpperCase();
  lines.push(`Mode 01 PID 0C response: 41 0C ${rpmA} ${rpmB}`);

  // PID 05: Coolant Temp (A - 40)
  const coolant = Math.max(-40, Math.min(215, Math.round(telemetry.coolant_temp_c ?? 88)));
  const coolantHex = (coolant + 40).toString(16).padStart(2, '0').toUpperCase();
  lines.push(`Mode 01 PID 05 response: 41 05 ${coolantHex}`);

  // PID 0D: Vehicle Speed (A)
  const speed = Math.max(0, Math.min(255, Math.round(telemetry.speed_kmh ?? 70)));
  const speedHex = speed.toString(16).padStart(2, '0').toUpperCase();
  lines.push(`Mode 01 PID 0D response: 41 0D ${speedHex}`);

  // PID 11: Throttle Position ((A * 100) / 255)
  const throttle = Math.max(0, Math.min(100, Math.round(telemetry.engine_load_pct ?? 45)));
  const throttleHex = Math.round((throttle * 255) / 100)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  lines.push(`Mode 01 PID 11 response: 41 11 ${throttleHex}`);

  // Mode 03: DTC codes
  if (telemetry.active_dtc_codes && telemetry.active_dtc_codes.length > 0) {
    const dtcHexTokens = telemetry.active_dtc_codes
      .map(encodeDtcToHex)
      .filter(Boolean)
      .join(' ');
    if (dtcHexTokens) {
      lines.push(`Mode 03 DTC response: 43 ${dtcHexTokens}`);
    }
  }

  return lines.join('\n');
}

