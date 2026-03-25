import api from '@/api/client';

export const fetchWarehouses = () => api.get('/warehouses');
