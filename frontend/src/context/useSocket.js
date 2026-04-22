/**
 * useSocket.js (Frontend)
 * React hook for real-time Socket.io notifications
 * Usage: const { socket, notifications } = useSocket();
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const useSocket = () => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user || !token) return;

    // Initialize socket connection
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setIsConnected(true);

      // Join user's personal room
      newSocket.emit('join_user_room', user.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    // Notification events
    newSocket.on('reassignment_request', (data) => {
      console.log('[Socket] Reassignment request:', data);
      setNotifications((prev) => [
        { ...data, type: 'reassignment_request', id: data.id },
        ...prev
      ]);
    });

    newSocket.on('counsellor_accepted', (data) => {
      console.log('[Socket] Counsellor accepted:', data);
      setNotifications((prev) => [
        { ...data, type: 'counsellor_accepted', id: data.id },
        ...prev
      ]);
    });

    newSocket.on('session_cancelled', (data) => {
      console.log('[Socket] Session cancelled:', data);
      setNotifications((prev) => [
        { ...data, type: 'session_cancelled', id: data.id },
        ...prev
      ]);
    });

    newSocket.on('session_confirmed', (data) => {
      console.log('[Socket] Session confirmed:', data);
      setNotifications((prev) => [
        { ...data, type: 'session_confirmed', id: data.id },
        ...prev
      ]);
    });

    newSocket.on('session_updated', (data) => {
      console.log('[Socket] Session updated:', data);
    });

    newSocket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, [user, token]);

  const removeNotification = useCallback((notificationId) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    socket,
    isConnected,
    notifications,
    removeNotification,
    clearNotifications
  };
};

export default useSocket;
