import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UserModel } from '../../models/User';
import type { Role } from '../../types';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (payload: { sub: string; tenantId: string; role: Role; email: string }): string => {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: `${config.JWT_ACCESS_EXPIRATION_MINUTES}m`
  });
};

const signRefreshToken = (payload: { sub: string; tenantId: string; role: Role; email: string }): string => {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: `${config.JWT_REFRESH_EXPIRATION_DAYS}d`
  });
};

export const register = async (
  tenantId: string,
  payload: { name: string; email: string; password: string; role?: Role }
) => {
  const exists = await UserModel.findOne({ tenantId, email: payload.email.toLowerCase() }).lean();
  if (exists) {
    throw new ApiError(409, 'Email already exists in tenant');
  }

  const user = await UserModel.create({
    tenantId,
    name: payload.name,
    email: payload.email.toLowerCase(),
    password: payload.password,
    role: payload.role ?? 'staff'
  });

  return {
    id: String(user._id),
    tenantId: String(user.tenantId),
    name: user.name,
    email: user.email,
    role: user.role
  };
};

export const login = async (tenantId: string, payload: { email: string; password: string }) => {
  const user = await UserModel.findOne({ tenantId, email: payload.email.toLowerCase(), isActive: true }).select('+password');
  if (!user?.password) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(payload.password, user.password);
  if (!valid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const jwtPayload = {
    sub: String(user._id),
    tenantId,
    role: user.role,
    email: user.email
  };

  const accessToken = signAccessToken(jwtPayload);
  const refreshToken = signRefreshToken(jwtPayload);

  user.refreshTokens.push({
    token: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  });
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      id: String(user._id),
      tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    }
  };
};

export const refreshTokens = async (refreshToken: string) => {
  let payload: { sub: string; tenantId: string; role: Role; email: string };
  try {
    payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as {
      sub: string;
      tenantId: string;
      role: Role;
      email: string;
    };
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await UserModel.findOne({
    _id: payload.sub,
    tenantId: payload.tenantId,
    'refreshTokens.token': hashToken(refreshToken)
  }).select('+refreshTokens');

  if (!user) {
    throw new ApiError(401, 'Refresh token not recognized');
  }

  const nextAccessToken = signAccessToken(payload);
  const nextRefreshToken = signRefreshToken(payload);
  const incomingTokenHash = hashToken(refreshToken);

  for (let i = user.refreshTokens.length - 1; i >= 0; i -= 1) {
    if (user.refreshTokens[i]?.token === incomingTokenHash) {
      user.refreshTokens.splice(i, 1);
    }
  }
  user.refreshTokens.push({
    token: hashToken(nextRefreshToken),
    expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
  });

  await user.save();

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken
  };
};

export const logout = async (tenantId: string, userId: string, refreshToken?: string): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  await UserModel.updateOne(
    { _id: userId, tenantId },
    {
      $pull: {
        refreshTokens: { token: hashToken(refreshToken) }
      }
    }
  );
};

export const forgotPassword = async (tenantId: string, email: string): Promise<void> => {
  const user = await UserModel.findOne({ tenantId, email: email.toLowerCase() }).select('+resetPasswordToken +resetPasswordExpires');
  if (!user) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = hashToken(rawToken);
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  logger.info('password_reset_token_generated', { userId: String(user._id), tenantId, token: rawToken });
};

export const resetPassword = async (tenantId: string, token: string, newPassword: string): Promise<void> => {
  const user = await UserModel.findOne({
    tenantId,
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() }
  }).select('+resetPasswordToken +resetPasswordExpires +password');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshTokens.splice(0, user.refreshTokens.length);
  await user.save();
};

export const createEmailVerificationToken = async (tenantId: string, userId: string): Promise<string> => {
  const user = await UserModel.findOne({ _id: userId, tenantId }).select('+emailVerificationToken +emailVerificationExpires');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  return rawToken;
};

export const verifyEmail = async (tenantId: string, token: string): Promise<void> => {
  const user = await UserModel.findOne({
    tenantId,
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() }
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
};
