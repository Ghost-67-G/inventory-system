import client from '@/api/client';
import type {
	IStockAlert,
	IStockMovement,
	ListAlertsParams,
	ListMovementsParams,
	RecordAdjustmentDto,
	RecordInDto,
	RecordOutDto,
	RecordTransferDto,
	RecordWasteDto,
	WarehouseStockPosition
} from '@/types';

export const stockApi = {
	recordIn: (data: RecordInDto) =>
		client.post<{ data: { movement: IStockMovement } }>('/stock/in', data),

	recordOut: (data: RecordOutDto) =>
		client.post<{ data: { movement: IStockMovement } }>('/stock/out', data),

	recordAdjustment: (data: RecordAdjustmentDto) =>
		client.post<{ data: { movement: IStockMovement } }>('/stock/adjustment', data),

	recordWaste: (data: RecordWasteDto) =>
		client.post<{ data: { movement: IStockMovement } }>('/stock/waste', data),

	recordTransfer: (data: RecordTransferDto) =>
		client.post<{ data: { movements: { out: IStockMovement; in: IStockMovement } } }>('/stock/transfer', data),

	listMovements: (params?: ListMovementsParams) =>
		client.get<{ data: { movements: IStockMovement[]; nextCursor: string | null; hasMore: boolean } }>('/stock', { params }),

	getMovement: (id: string) =>
		client.get<{ data: { movement: IStockMovement } }>(`/stock/${id}`),

	getProductStock: (productId: string) =>
		client.get<{ data: { stock: WarehouseStockPosition[] } }>(`/stock/product/${productId}`),

	listAlerts: (params?: ListAlertsParams) =>
		client.get<{ data: { alerts: IStockAlert[]; nextCursor: string | null; hasMore: boolean } }>('/stock/alerts', { params }),

	getAlertCount: () =>
		client.get<{ data: { count: number } }>('/stock/alerts/count'),

	acknowledgeAlert: (id: string) =>
		client.post<{ data: { alert: IStockAlert } }>(`/stock/alerts/${id}/acknowledge`),

	bulkAcknowledge: (alertIds: string[]) =>
		client.post<{ data: { acknowledged: number } }>('/stock/alerts/bulk-acknowledge', { alertIds })
};
