import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AccessTokenPayload {
  userId: string;
  tenantId: string;
  role: string;
  name?: string;
  email?: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tenantId: string;
  iat: number;
  exp: number;
}

export function generateAccessToken(payload: {
  userId: string;
  tenantId: string;
  role: string;
  name: string;
  email: string;
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      name: payload.name,
      email: payload.email
    },
    config.JWT_ACCESS_SECRET,
    { expiresIn: `${config.JWT_ACCESS_EXPIRATION_MINUTES}m` }
  );
}

export function generateRefreshToken(payload: { userId: string; tenantId: string }): string {
  return jwt.sign(
    { userId: payload.userId, tenantId: payload.tenantId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: `${config.JWT_REFRESH_EXPIRATION_DAYS}d` }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
