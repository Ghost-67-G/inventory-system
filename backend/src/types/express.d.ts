import type { Role } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        role: Role;
        email: string;
      };
      tenantId?: string;
      requestId?: string;
    }
  }
}

export {};
