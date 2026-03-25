import crypto from 'crypto';
import type { FilterQuery } from 'mongoose';
import { config } from '../../config';
import { TenantModel } from '../../models/Tenant';
import type { IUser } from '../../models/User';
import { UserModel } from '../../models/User';
import { hasPermission, type Permission, type Role } from '../../types';
import { ApiError } from '../../utils/ApiError';
import { sendInviteEmail } from '../../utils/email';
import { hashToken } from '../../utils/jwt';

export type SafeUser = Pick<
  IUser,
  '_id' | 'tenantId' | 'name' | 'email' | 'role' | 'isActive' | 'isEmailVerified' | 'lastLoginAt' | 'createdAt' | 'updatedAt'
>;

interface ListUsersQuery {
  page?: number;
  limit?: number;
  role?: Role;
  isActive?: 'true' | 'false';
  search?: string;
}

interface InviteUserDto {
  name: string;
  email: string;
  role: Role;
}

interface UpdateUserDto {
  name?: string;
  role?: Role;
}

interface UpdateMyProfileDto {
  name: string;
}

interface ListUsersResult {
  users: SafeUser[];
  total: number;
  page: number;
  totalPages: number;
}

const SENSITIVE_FIELD_PROJECTION =
  '-password -refreshTokens -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires';

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

function assertServicePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ApiError(403, `Forbidden: requires '${permission}' permission`);
  }
}

export async function listUsers(tenantId: string, requesterRole: Role, query: ListUsersQuery): Promise<ListUsersResult> {
  assertServicePermission(requesterRole, 'user.view');

  const page = Math.max(query.page ?? 1, 1);
  const limit = Math.min(Math.max(query.limit ?? 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter: FilterQuery<IUser> = { tenantId };

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true';
  }

  if (query.search?.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { email: searchRegex }];
  }

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select(SENSITIVE_FIELD_PROJECTION)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<SafeUser[]>(),
    UserModel.countDocuments(filter)
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function getUser(tenantId: string, requesterRole: Role, userId: string): Promise<SafeUser> {
  assertServicePermission(requesterRole, 'user.view');

  const user = await UserModel.findOne({ _id: userId, tenantId }).select(SENSITIVE_FIELD_PROJECTION);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return toSafeUser(user);
}

export async function inviteUser(
  tenantId: string,
  invitedByUserId: string,
  invitedByRole: Role,
  data: InviteUserDto
): Promise<SafeUser> {
  assertServicePermission(invitedByRole, 'user.invite');

  if (data.role === 'owner') {
    throw new ApiError(400, 'Cannot assign owner role');
  }

  const normalizedEmail = data.email.toLowerCase();
  const existing = await UserModel.findOne({ tenantId, email: normalizedEmail });

  if (existing?.isActive) {
    throw new ApiError(409, 'A user with this email already exists');
  }

  if (existing && !existing.isActive) {
    throw new ApiError(409, 'This email belongs to a deactivated account');
  }

  const tempPassword = crypto.randomBytes(8).toString('hex');
  const rawVerificationToken = crypto.randomBytes(32).toString('hex');

  const user = await UserModel.create({
    tenantId,
    name: data.name,
    email: normalizedEmail,
    password: tempPassword,
    role: data.role,
    isActive: true,
    isEmailVerified: false,
    emailVerificationToken: hashToken(rawVerificationToken),
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  const [inviter, tenant] = await Promise.all([
    UserModel.findOne({ _id: invitedByUserId, tenantId }).select('name').lean<{ name: string }>(),
    TenantModel.findById(tenantId).select('name').lean<{ name: string }>()
  ]);

  const inviterName = inviter?.name ?? 'Your team admin';
  const tenantName = tenant?.name ?? 'Inventory System';
  const acceptInviteUrl = `${config.FRONTEND_URL}/accept-invite?token=${rawVerificationToken}`;

  // Fire and forget: invite creation must not fail on email provider errors.
  void sendInviteEmail(user.email, {
    inviteeName: user.name,
    inviterName,
    tenantName,
    temporaryPassword: tempPassword,
    acceptInviteUrl
  }).catch(() => undefined);

  return toSafeUser(user);
}

export async function updateUser(
  tenantId: string,
  requesterId: string,
  requesterRole: Role,
  targetUserId: string,
  data: UpdateUserDto
): Promise<SafeUser> {
  assertServicePermission(requesterRole, 'user.update');

  const target = await UserModel.findOne({ _id: targetUserId, tenantId });
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  if (requesterId === targetUserId && data.role) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  if (target.role === 'owner' && data.role) {
    throw new ApiError(400, 'Cannot change the role of an owner');
  }

  if (data.role === 'owner') {
    throw new ApiError(400, 'Cannot assign owner role');
  }

  if (data.name !== undefined) {
    target.name = data.name;
  }

  if (data.role !== undefined) {
    target.role = data.role;
  }

  await target.save();
  return toSafeUser(target);
}

export async function deactivateUser(
  tenantId: string,
  requesterId: string,
  requesterRole: Role,
  targetUserId: string
): Promise<void> {
  assertServicePermission(requesterRole, 'user.deactivate');

  const target = await UserModel.findOne({ _id: targetUserId, tenantId });
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  if (requesterId === targetUserId) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  if (target.role === 'owner' && target.isActive) {
    const activeOwnerCount = await UserModel.countDocuments({ tenantId, role: 'owner', isActive: true });
    if (activeOwnerCount <= 1) {
      throw new ApiError(400, 'Cannot deactivate the only owner account');
    }
  }

  target.isActive = false;
  target.refreshTokens = [];
  await target.save();
}

export async function reactivateUser(
  tenantId: string,
  _requesterId: string,
  requesterRole: Role,
  targetUserId: string
): Promise<SafeUser> {
  assertServicePermission(requesterRole, 'user.deactivate');

  const target = await UserModel.findOne({ _id: targetUserId, tenantId });
  if (!target) {
    throw new ApiError(404, 'User not found');
  }

  if (target.isActive) {
    throw new ApiError(400, 'User is already active');
  }

  target.isActive = true;
  await target.save();
  return toSafeUser(target);
}

export async function getMyProfile(userId: string, tenantId: string): Promise<SafeUser> {
  const user = await UserModel.findOne({ _id: userId, tenantId }).select(SENSITIVE_FIELD_PROJECTION);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  return toSafeUser(user);
}

export async function updateMyProfile(userId: string, tenantId: string, data: UpdateMyProfileDto): Promise<SafeUser> {
  const user = await UserModel.findOne({ _id: userId, tenantId });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.name = data.name;
  await user.save();
  return toSafeUser(user);
}
