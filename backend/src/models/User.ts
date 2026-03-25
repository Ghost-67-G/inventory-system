import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'manager', 'staff', 'viewer'], default: 'staff' },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    refreshTokens: { type: [refreshTokenSchema], default: [] },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false }
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.pre('save', async function hashPassword(next) {
  const doc = this as HydratedDocument<InferSchemaType<typeof userSchema>>;
  if (!doc.isModified('password')) {
    next();
    return;
  }

  doc.password = await bcrypt.hash(doc.password, 12);
  next();
});

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model<User>('User', userSchema);
