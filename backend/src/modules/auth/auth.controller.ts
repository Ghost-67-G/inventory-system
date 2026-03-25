import type { Request, Response } from 'express';
import { config } from '../../config';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import * as authService from './auth.service';

const refreshCookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const tenantId = req.body.tenantId ?? req.tenantId;
  if (!tenantId) {
    throw new ApiError(400, 'tenantId is required');
  }

  const user = await authService.register(tenantId, req.body);
  res.status(201).json({ success: true, data: user });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const tenantId = req.body.tenantId ?? req.tenantId;
  if (!tenantId) {
    throw new ApiError(400, 'tenantId is required');
  }

  const result = await authService.login(tenantId, req.body);
  res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

  res.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user
    }
  });
});

export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const incomingRefresh = req.cookies?.refreshToken as string | undefined;
  if (!incomingRefresh) {
    throw new ApiError(401, 'Refresh token missing');
  }

  const tokens = await authService.refreshTokens(incomingRefresh);
  res.cookie('refreshToken', tokens.refreshToken, refreshCookieOptions);
  res.status(200).json({ success: true, data: { accessToken: tokens.accessToken } });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  if (!req.user || !req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const incomingRefresh = req.cookies?.refreshToken as string | undefined;
  await authService.logout(req.tenantId, req.user.id, incomingRefresh);

  res.clearCookie('refreshToken', refreshCookieOptions);
  res.status(200).json({ success: true, data: { message: 'Logged out' } });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId is required');
  }

  await authService.forgotPassword(req.tenantId, req.body.email);
  res.status(200).json({ success: true, data: { message: 'If account exists, reset email sent' } });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId is required');
  }

  await authService.resetPassword(req.tenantId, req.body.token, req.body.newPassword);
  res.status(200).json({ success: true, data: { message: 'Password reset successful' } });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  if (!req.tenantId) {
    throw new ApiError(400, 'tenantId is required');
  }

  await authService.verifyEmail(req.tenantId, req.body.token);
  res.status(200).json({ success: true, data: { message: 'Email verified' } });
});

export const requestVerifyEmail = catchAsync(async (req: Request, res: Response) => {
  if (!req.user || !req.tenantId) {
    throw new ApiError(401, 'Unauthorized');
  }

  const token = await authService.createEmailVerificationToken(req.tenantId, req.user.id);
  res.status(200).json({ success: true, data: { message: 'Verification token generated', token } });
});
