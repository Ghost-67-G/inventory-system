import { WarehouseModel } from '../../models/Warehouse';

export const listWarehouses = async (tenantId: string) => {
  return WarehouseModel.find({ tenantId }).lean();
};
