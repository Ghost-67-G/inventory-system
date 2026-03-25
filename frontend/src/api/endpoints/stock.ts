import api from '../client';

export const fetchStockMovements = () => api.get('/stock/movements');
