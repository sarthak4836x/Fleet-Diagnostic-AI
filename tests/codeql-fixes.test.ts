// Regression tests for the issues CodeQL code scanning reported on the first public release.
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { payloadSanitizationMiddleware } from '../server';

function sanitize(body: unknown): unknown {
  const req = { body, headers: {}, socket: { remoteAddress: '127.0.0.1' }, originalUrl: '/test', url: '/test' } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  payloadSanitizationMiddleware(req, res, next);
  expect(next).toHaveBeenCalled();
  return req.body;
}

describe('script tag neutralising (js/bad-tag-filter)', () => {
  // Every one of these slipped past the old "<script>...</script>" regex.
  const bypasses = [
    '<script>alert(1)</script>',
    '<script>alert(1)</script >',
    '<script/x>alert(1)</script>',
    '<SCRIPT SRC=//evil.example/x.js>',
    '< script>alert(1)',
    'text </script><script>alert(1)',
  ];

  it.each(bypasses)('leaves no raw tag in %j', (payload) => {
    const out = sanitize({ notes: payload }) as { notes: string };
    expect(out.notes).not.toMatch(/<[\s/]*script/i);
    expect(out.notes).not.toContain('<');
    expect(out.notes).not.toContain('>');
  });

  it('does not touch ordinary text, including angle brackets in normal use', () => {
    const out = sanitize({ notes: 'Coolant 104 °C > limit; soot < 18 g', n: 5 }) as { notes: string; n: number };
    expect(out).toEqual({ notes: 'Coolant 104 °C > limit; soot < 18 g', n: 5 });
  });
});

describe('security log lines (js/log-injection)', () => {
  it('cannot be split into forged lines by CR/LF in user input', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sanitize({ notes: '<script>x</script>\n[SECURITY SHIELD] [INFO] AUTH_SUCCESS forged' });
    const lines = warn.mock.calls.map((c) => String(c[0]));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toMatch(/[\r\n]/);
    warn.mockRestore();
  });
});
