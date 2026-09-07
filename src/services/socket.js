import { io } from 'socket.io-client';

export const getSocketUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  if (window.location.origin.includes('vercel.app') || window.location.origin.includes('onrender.com')) {
    return 'https://siemreap-api.onrender.com';
  }
  return '/';
};

export const createSocket = () => {
  const url = getSocketUrl();
  return io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });
};

export default createSocket;
