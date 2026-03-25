import { StockAlertModel } from '../../models/StockAlert';

export const listAlerts = async (tenantId: string) => {
  return StockAlertModel.find({ tenantId }).sort({ createdAt: -1 }).lean();
};
