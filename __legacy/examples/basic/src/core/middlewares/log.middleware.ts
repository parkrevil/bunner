import type { AppRef, Middleware } from '../../../../../src/web-application/providers/middleware';
import type { BunnerRequest } from '../../../../../src/web-application/request';
import type { BunnerResponse } from '../../../../../src/web-application/response';
import { UsersService } from '../../users/users.service';

export const log = (label: string): Middleware => (req) => {
  console.log(`[${label}] ${req.path}`);
};

export const timeStart = (label: string): Middleware => () => {
  console.log(`[time.start] ${label} start`);
};

export const timeEnd = (label: string): Middleware => () => {
  console.log(`[time.end] ${label} end`);
};

export const authCheck = (): Middleware => () => {
  console.log('[auth] check');
};

export const shortCircuit = (label: string, body: any): Middleware => (req, res) => {
  console.log(`[short-circuit] ${label}`);
  return res.setBody(body);
};

export const throwError = (label: string): Middleware => () => {
  console.log(`[throw] ${label}`);
  throw new Error(label);
};

export const delay = (label: string, ms: number): Middleware => async () => {
  console.log(`[delay.start] ${label} ${ms}ms`);
  await new Promise((r) => setTimeout(r, ms));
  console.log(`[delay.end] ${label}`);
};

export const userGuard = (): Middleware => async (req: BunnerRequest, res: BunnerResponse, app: AppRef) => {
  const users = app.get<UsersService>(UsersService);
  const id = Number(req.params.id ?? 0);
  const user = users.getById(id);
  if (!user) {
    return res.setStatus(404).setBody({ code: 'USER_NOT_FOUND' });
  }
  req.setCustomData('user', user);
};


