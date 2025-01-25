"use client";
import { customAlphabet, nanoid } from "nanoid";
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { io } from "socket.io-client";
import { Socket } from "socket.io-client/debug";

const SocketContext = createContext<any>({});

export const useSocket = () => {
  const socket: {
    socket: Socket;
    userId: any;
    SocketId: any;
    setSocketId: any;
    peerState: any;
    setpeerState: any;
    connectionError: string;
  } = useContext(SocketContext);
  return socket;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socket = useMemo(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:8000';
    return io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true
    });
  }, []);

  const [peerState, setpeerState] = useState<any>();
  const [SocketId, setSocketId] = useState<any>();
  const [connectionError, setConnectionError] = useState<string>('');
  
  const userId = useMemo(() => {
    const id = nanoid(10);
    console.log('Generated userId:', id);
    return id;
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      console.log('Connected to server with ID:', socket.id);
      setSocketId(socket.id);
      setConnectionError('');
      
      // Send initial details to server
      if (socket.id && userId) {
        socket.emit('details', {
          socketId: socket.id,
          uniqueId: userId
        });
      }
    };

    const handleConnectError = (error: Error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server');
    };

    const handleDisconnect = (reason: string) => {
      console.log('Disconnected:', reason);
      setSocketId(null);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    // Force reconnect if not connected
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, userId]);

  return (
    <SocketContext.Provider
      value={{ 
        socket, 
        userId, 
        SocketId, 
        setSocketId, 
        peerState, 
        setpeerState,
        connectionError 
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
