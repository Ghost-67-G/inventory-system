import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../../config';
import { redis } from '../../config/redis';
import type { ITenant } from '../../models/Tenant';
import { TenantModel } from '../../models/Tenant';
import type { IUser } from '../../models/User';
import { UserModel } from '../../models/User';
import { ApiError } from '../../utils/ApiError';
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from '../../utils/email';
import { generateAccessToken, generateRefreshToken, hashToken, verifyRefreshToken } from '../../utils/jwt';

export type SafeUser = Pick<
  IUser,
  '_id' | 'tenantId' | 'name' | 'email' | 'role' | 'isActive' | 'isEmailVerified' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
>;

function toSafeUser(user: IUser): SafeUser {
  return {
    _id: user._id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') +
    '-' +
    crypto.randomBytes(3).toString('hex')
  );
}

async function getSelfHostedTenant(): Promise<ITenant> {
  const cached = await redis.get('self_hosted:tenantId');
  if (cached) {
    const tenant = await TenantModel.findById(cached);
    if (tenant) return tenant;
  }
  const tenant = await TenantModel.findOne();
  if (!tenant) throw new ApiError(404, 'Tenant not found');
  await redis.set('self_hosted:tenantId', String(tenant._id), 'EX', 3600);
  return tenant;
}

// ─── Register ────────────────────────────────────────────────────────────────

interface RegisterDto {
  name: string;
  email: string;
  password: string;
  tenantName?: string;
}

export async function register(data: RegisterDto): Promise<{ user: SafeUser; tenant: ITenant }> {
  let tenant: ITenant;

  if (config.DEPLOYMENT_MODE === 'saas') {
    if (!data.tenantName) throw new ApiError(400, 'tenantName is required');
    tenant = await TenantModel.create({
      name: data.tenantName,
      slug: generateSlug(data.tenantName)
    });
  } else {
    tenant = await getSelfHostedTenant();
  }

  const existing = await UserModel.findOne({ tenantId: tenant._id, email: data.email.toLowerCase() });
  if (existing) throw new ApiError(409, 'Email already registered');

  const rawToken = crypto.randomBytes(32).toString('hex');
  const user = await UserModel.create({
    tenantId: tenant._id,
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
    role: 'owner',
    isEmailVerified: false,
    emailVerificationToken: hashToken(rawToken),
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  // Fire and forget
  void sendVerificationEmail(user.email, user.name, rawToken).catch(() => undefined);

  return { user: toSafeUser(user), tenant };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
  let user: IUser | null;

  if (config.DEPLOYMENT_MODE === 'self_hosted') {
    const tenant = await getSelfHostedTenant();
    user = await UserModel.findOne({ tenantId: tenant._id, email: email.toLowerCase() }).select('+password');
  } else {
    // SAAS: find by email globally
    user = await UserModel.findOne({ email: email.toLowerCase() }).select('+password');
  }

  // Constant-time comparison to prevent timing attacks even when user not found
  const dummyHash = '$2a$12$invalidhashfortimingprotectiononly000000000000000000000';
  const candidatePassword = user?.password ?? dummyHash;
  const passwordMatch = await bcrypt.compare(password, candidatePassword);

  if (!user || !passwordMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is disabled');
  }

  const accessToken = generateAccessToken({
    userId: String(user._id),
    tenantId: String(user.tenantId),
    role: user.role
  });
  const refreshToken = generateRefreshToken({
    userId: String(user._id),
    tenantId: String(user.tenantId)
  });

  const tokens = user.refreshTokens;
  if (tokens.length >= 5) {
    tokens.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    tokens.splice(0, tokens.length - 4);
  }
  tokens.push({
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    userAgent: userAgent ?? null
  });
  user.lastLoginAt = new Date();
  await user.save();

  return { accessToken, refreshToken, user: toSafeUser(user) };
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

export async function refreshToken(token: string): Promise<{ accessToken: string; newRefreshToken: string }> {
  const payload = verifyRefreshToken(token);
  if (!payload) throw new ApiError(401, 'Session expired. Please login again.');

  const tokenHash = hashToken(token);
  const user = await UserModel.findById(payload.userId);

  if (!user) {
    throw new ApiError(401, 'Session expired. Please login again.');
  }

  const tokenIndex = user.refreshTokens.findIndex((t) => t.tokenHash === tokenHash);

  if (tokenIndex === -1) {
    // Refresh token reuse detected — clear ALL tokens
    user.refreshTokens = [];
    await user.save();
    throw new ApiError(401, 'Session expired. Please login again.');
  }

  // Rotate: remove used token
  user.refreshTokens.splice(tokenIndex, 1);

  const accessToken = generateAccessToken({
    userId: String(user._id),
    tenantId: String(user.tenantId),
    role: user.role
  });
  const newRefreshToken = generateRefreshToken({
    userId: String(user._id),
    tenantId: String(user.tenantId)
  });

  if (user.refreshTokens.length >= 5) {
    user.refreshTokens.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    user.refreshTokens.splice(0, user.refreshTokens.length - 4);
  }
  user.refreshTokens.push({
    tokenHash: hashToken(newRefreshToken),
    expiresAt: new Date(Date.now() + config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    userAgent: null
  });
  await user.save();

  return { accessToken, newRefreshToken };
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logout(userId: string, refreshTokenValue: string): Promise<void> {
  const tokenHash = hashToken(refreshTokenValue);
  await UserModel.updateOne({ _id: userId }, { $pull: { refreshTokens: { tokenHash } } });
}

export async function logoutAll(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

// ─── Email Verification ───────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() }
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) throw new ApiError(400, 'Invalid or expired verification token');

  user.isEmailVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  const tenant = await TenantModel.findById(user.tenantId);
  const tenantName = tenant?.name ?? 'Inventory System';
  void sendWelcomeEmail(user.email, user.name, tenantName).catch(() => undefined);
}

// ─── Forgot / Reset Password ─────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<void> {
  let user: IUser | null;

  if (config.DEPLOYMENT_MODE === 'self_hosted') {
    const tenant = await getSelfHostedTenant();
    user = await UserModel.findOne({ tenantId: tenant._id, email: email.toLowerCase() });
  } else {
    user = await UserModel.findOne({ email: email.toLowerCase() });
  }

  if (!user) return; // Silent — never reveal if email exists

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  void sendPasswordResetEmail(user.email, user.name, rawToken).catch(() => undefined);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const user = await UserModel.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetToken +passwordResetExpires +password');

  if (!user) throw new ApiError(400, 'Invalid or expired reset token');

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.refreshTokens = [];
  await user.save();
}

// ─── Change Password ─────────────────────────────────────────────────────────

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await UserModel.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new ApiError(401, 'Current password is incorrect');

  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();
}

// ─── Resend Verification ──────────────────────────────────────────────────────

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.isEmailVerified) throw new ApiError(400, 'Email already verified');

  const rateLimitKey = `resend_verify:${userId}`;
  const existing = await redis.get(rateLimitKey);
  if (existing) throw new ApiError(429, 'Please wait before requesting another email');

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  await redis.set(rateLimitKey, '1', 'EX', 60);
  void sendVerificationEmail(user.email, user.name, rawToken).catch(() => undefined);
}

// ─── Get Me ───────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await UserModel.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return toSafeUser(user);
}
