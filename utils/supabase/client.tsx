// Neon API Configuration
// Update this URL to your deployed API server or use localhost for development
export const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 
  'http://localhost:3001';

export function getAuthHeaders(userId?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (userId) {
    headers['X-User-ID'] = userId;
  }
  
  return headers;
}