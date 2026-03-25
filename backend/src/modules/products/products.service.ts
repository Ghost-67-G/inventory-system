import { ProductModel } from '../../models/Product';

export const listProducts = async (tenantId: string) => {
  return ProductModel.find({ tenantId }).lean();
};
