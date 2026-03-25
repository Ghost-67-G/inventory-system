import { UserModel } from '../../models/User';

export const listUsers = async (tenantId: string) => {
  return UserModel.find({ tenantId }).select('-password -refreshTokens').lean();
};
