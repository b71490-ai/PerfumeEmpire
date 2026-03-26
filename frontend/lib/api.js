import api from '../utils/axiosInstance';

export async function fetchPerfumes() {
  const res = await api.get('/perfumes');
  return res.data;
}

export async function createPerfume(perfumeData) {
  const res = await api.post('/perfumes', perfumeData);
  return res.data;
}

export async function getPerfumeById(id) {
  const res = await api.get(`/perfumes/${id}`);
  return res.data;
}

export async function updatePerfume(id, perfumeData) {
  const res = await api.put(`/perfumes/${id}`, perfumeData);
  return res.data;
}

export async function deletePerfume(id) {
  await api.delete(`/perfumes/${id}`);
}

export async function createOrder(orderData) {
  const res = await api.post('/orders', orderData);
  return res.data;
}

export async function fetchOrders() {
  const res = await api.get('/orders');
  return res.data;
}

export async function fetchOrderById(orderId) {
  const res = await api.get(`/orders/${orderId}`);
  return res.data;
}

export async function fetchOrderHistory(orderId) {
  const res = await api.get(`/orders/${orderId}/history`);
  return res.data;
}

export async function updateOrderStatus(orderId, payload) {
  const res = await api.put(`/orders/${orderId}/status`, payload);
  return res.data;
}

export async function updateOrderPaymentStatus(orderId, payload) {
  const res = await api.put(`/orders/${orderId}/payment-status`, payload);
  return res.data;
}

export async function requestCustomerOtp(phone) {
  const res = await api.post('/orders/customer/request-otp', { phone });
  return res.data;
}

export async function verifyCustomerOtp(phone, code) {
  const res = await api.post('/orders/customer/verify-otp', { phone, code });
  return res.data;
}

export async function trackOrder(orderId, phone, accessToken) {
  const res = await api.get(`/orders/track/${orderId}`, { params: { phone, accessToken } });
  return res.data;
}

export async function fetchCustomerOrders(phone, accessToken) {
  const res = await api.get('/orders/customer', { params: { phone, accessToken } });
  return res.data;
}

export async function fetchPerfumeReviews(id) {
  const res = await api.get(`/perfumes/${id}/reviews`);
  return res.data;
}

export async function createPerfumeReview(id, payload) {
  const res = await api.post(`/perfumes/${id}/reviews`, payload);
  return res.data;
}

export async function exportOrdersCsv() {
  const res = await api.get('/orders/export/csv', { responseType: 'blob' });
  return res.data;
}

export async function fetchAdminUsers() {
  const res = await api.get('/admin/users');
  return res.data;
}

export async function updateAdminUser(userId, payload) {
  const res = await api.put(`/admin/users/${userId}`, payload);
  return res.data;
}

export async function createAdminUser(payload) {
  const res = await api.post('/admin/users', payload);
  return res.data;
}

export async function resetAdminUserPassword(userId, payload) {
  const res = await api.put(`/admin/users/${userId}/password`, payload);
  return res.data;
}

export async function deleteAdminUser(userId) {
  const res = await api.delete(`/admin/users/${userId}`);
  return res.data;
}

export async function fetchStoreSettings() {
  const res = await api.get('/store-settings');
  return res.data;
}

export async function updateStoreSettings(payload) {
  const res = await api.put('/store-settings', payload);
  return res.data;
}

export async function submitContactMessage(payload) {
  const res = await api.post('/contact-messages', payload);
  return res.data;
}

export async function searchPerfumesByImage(formData, config = {}) {
  // Let axios set the Content-Type (including boundary) automatically
  // `config` may include `signal` (AbortController) or other axios config
  const res = await api.post('/perfumes/search-by-image', formData, config);
  return res.data;
}
