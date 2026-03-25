import api from '../client';

export const fetchWarehouses = () => api.get('/warehouses');
