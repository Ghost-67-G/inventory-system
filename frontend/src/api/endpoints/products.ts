import api from '../client';

export const fetchProducts = () => api.get('/products');
