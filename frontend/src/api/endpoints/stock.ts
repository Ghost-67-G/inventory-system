import api from '@/api/client';

export const fetchStockMovements = () => api.get('/stock/movements');
