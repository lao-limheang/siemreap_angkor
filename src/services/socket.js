import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Both direct port 3000 and window.location.origin (via Vite proxy) are supported
    return 'http://localhost:3000';
  }
  if (window.location.origin.includes('vercel.app') || window.location.origin.includes('onrender.com')) {
    return 'https://siemreap-api.onrender.com';
  }
  return window.location.origin || '/';
};

let sharedSocket = null;

export const getSocket = () => {
  if (!sharedSocket || sharedSocket.disconnected) {
    const url = getSocketUrl();
    sharedSocket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 4000,
      timeout: 10000
    });

    sharedSocket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend:', sharedSocket.id);
    });

    sharedSocket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message);
    });
  }
  return sharedSocket;
};

export const createSocket = () => {
  return getSocket();
};

export default getSocket;
