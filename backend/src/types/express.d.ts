import type { Role } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: Role;
      };
      tenantId?: string;
      requestId?: string;
    }
  }
}

export {};
