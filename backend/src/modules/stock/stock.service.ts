import { StockMovementModel } from '../../models/StockMovement';

export const listMovements = async (tenantId: string) => {
  return StockMovementModel.find({ tenantId }).sort({ createdAt: -1 }).lean();
};
