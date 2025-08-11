// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

// App Configuration
export const APP_CONFIG = {
  name: 'StreamlinAI',
  description: 'Redis 8 Powered AI Content Moderation Platform',
  version: '1.0.0',
  features: {
    realTimeUpdates: true,
    vectorSearch: true,
    analytics: true,
    contentModeration: true
  }
};
