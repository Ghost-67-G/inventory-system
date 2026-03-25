import api from '../client';

export const fetchAlerts = () => api.get('/alerts');
