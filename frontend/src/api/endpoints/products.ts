import api from '@/api/client';

export const fetchProducts = () => api.get('/products');
