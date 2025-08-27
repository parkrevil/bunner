import type { Middleware } from '../../../../../src/web-application/providers/middleware';

export const log = (label: string): Middleware => ({
  run: (req, res) => {
    console.log(`[${label}] ${req.path}`);
  },
});

export const timeStart = (label: string): Middleware => ({
  run: () => {
    console.log(`[time.start] ${label} start`);
  },
});

export const timeEnd = (label: string): Middleware => ({
  run: () => {
    console.log(`[time.end] ${label} end`);
  },
});

export const authCheck = (): Middleware => ({
  run: (req) => {
    console.log('[auth] check');
  },
});

export const shortCircuit = (label: string, body: any): Middleware => ({
  run: (req, res) => {
    console.log(`[short-circuit] ${label}`);
    return res.setBody(body);
  },
});

export const throwError = (label: string): Middleware => ({
  run: () => {
    console.log(`[throw] ${label}`);
    throw new Error(label);
  },
});

export const delay = (label: string, ms: number): Middleware => ({
  run: async () => {
    console.log(`[delay.start] ${label} ${ms}ms`);
    await new Promise((r) => setTimeout(r, ms));
    console.log(`[delay.end] ${label}`);
  },
});


