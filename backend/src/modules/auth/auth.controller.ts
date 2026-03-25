import type { Request, Response } from 'express';
import { config } from '../../config';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as authService from './auth.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/auth'
};

function getRefreshTokenCandidates(req: Request): string[] {
  const candidates: string[] = [];

  const parsedCookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (parsedCookieToken) {
    candidates.push(parsedCookieToken);
  }

  const rawCookieHeader = req.headers.cookie;
  if (!rawCookieHeader) {
    return [...new Set(candidates)];
  }

  const rawParts = rawCookieHeader.split(';');
  for (const part of rawParts) {
    const trimmed = part.trim();
    const prefix = `${REFRESH_COOKIE_NAME}=`;
    if (!trimmed.startsWith(prefix)) {
      continue;
    }

    const value = trimmed.slice(prefix.length);
    if (value) {
      candidates.push(decodeURIComponent(value));
    }
  }

  return [...new Set(candidates)];
}

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user } = await authService.register(req.body as Parameters<typeof authService.register>[0]);
  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: { user }
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const userAgent = req.headers['user-agent'];
  const { accessToken, refreshToken, user } = await authService.login(email, password, userAgent);

  // Clear legacy cookie path to avoid duplicate refreshToken keys in browser requests.
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res.status(200).json({ success: true, data: { accessToken, user } });
});

export const refreshTokenHandler = catchAsync(async (req: Request, res: Response) => {
  const tokenCandidates = getRefreshTokenCandidates(req);
  if (tokenCandidates.length === 0) {
    throw new ApiError(401, 'Session expired. Please login again.');
  }

  for (const candidate of tokenCandidates) {
    try {
      const { accessToken, newRefreshToken } = await authService.refreshToken(candidate);
      // Keep both clearCookie calls to remove duplicate-name cookies from earlier implementations.
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions);
      res.status(200).json({ success: true, data: { accessToken } });
      return;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        continue;
      }
      throw error;
    }
  }

  throw new ApiError(401, 'Session expired. Please login again.');
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const incoming = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (incoming) {
    await authService.logout(req.user!.id, incoming);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const logoutAll = catchAsync(async (req: Request, res: Response) => {
  await authService.logoutAll(req.user!.id);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out from all devices' });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  await authService.verifyEmail(token);
  res.status(200).json({ success: true, message: 'Email verified successfully' });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.forgotPassword(email);
  res.status(200).json({ success: true, message: 'If that email exists, a reset link has been sent' });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, password } = req.body as { token: string; password: string };
  await authService.resetPassword(token, password);
  res.status(200).json({ success: true, message: 'Password reset successfully' });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.status(200).json({ success: true, message: 'Password changed successfully' });
});

export const resendVerification = catchAsync(async (req: Request, res: Response) => {
  await authService.resendVerificationEmail(req.user!.id);
  res.status(200).json({ success: true, message: 'Verification email sent' });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json({ success: true, data: { user } });
});

