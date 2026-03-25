import bcrypt from 'bcryptjs';
import mongoose, { Document, Schema, model } from 'mongoose';

const MAX_REFRESH_TOKENS = 5;

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'owner' | 'manager' | 'staff' | 'viewer';
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  lastLoginAt: Date | null;
  refreshTokens: Array<{
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
    userAgent: string | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasRefreshToken(tokenHash: string): boolean;
}

const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    userAgent: { type: String, default: null }
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'manager', 'staff', 'viewer'], default: 'staff' },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },
    passwordResetToken: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
    refreshTokens: { type: [refreshTokenSchema], default: [] }
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password as string);
};

userSchema.methods.hasRefreshToken = function (tokenHash: string): boolean {
  return (this.refreshTokens as IUser['refreshTokens']).some((t) => t.tokenHash === tokenHash);
};

userSchema.methods.addRefreshToken = function (entry: IUser['refreshTokens'][number]): void {
  const tokens = this.refreshTokens as IUser['refreshTokens'];
  if (tokens.length >= MAX_REFRESH_TOKENS) {
    tokens.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    tokens.splice(0, tokens.length - MAX_REFRESH_TOKENS + 1);
  }
  tokens.push(entry);
};

export const UserModel = model<IUser>('User', userSchema);
