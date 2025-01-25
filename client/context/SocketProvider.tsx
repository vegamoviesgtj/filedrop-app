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
    connectionStatus: string;
  } = useContext(SocketContext);
  return socket;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<any>(null);
  const [peerState, setpeerState] = useState<any>();
  const [SocketId, setSocketId] = useState<any>();
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  const userId = useMemo(() => {
    const id = nanoid(10);
    console.log('Generated userId:', id);
    return id;
  }, []);

  useEffect(() => {
    const initializeSocket = () => {
      try {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:8000';
        console.log('Connecting to socket server:', socketUrl);
        
        const newSocket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: maxReconnectAttempts,
          reconnectionDelay: 1000,
          timeout: 20000
        });

        setSocket(newSocket);
        
        newSocket.on('connect', () => {
          console.log('Connected to server with ID:', newSocket.id);
          setSocketId(newSocket.id);
          setConnectionStatus('connected');
          reconnectAttempts.current = 0;

          // Send initial details to server
          newSocket.emit('details', {
            socketId: newSocket.id,
            uniqueId: userId
          });
        });

        newSocket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          setConnectionStatus('error');
          
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            console.log(`Reconnect attempt ${reconnectAttempts.current} of ${maxReconnectAttempts}`);
            setTimeout(() => {
              newSocket.connect();
            }, 1000 * reconnectAttempts.current);
          }
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Disconnected:', reason);
          setSocketId(null);
          setConnectionStatus('disconnected');
          
          if (reason === 'io server disconnect') {
            // Server disconnected us, try to reconnect
            newSocket.connect();
          }
        });

        // Handle server acknowledgment
        newSocket.on('details_ack', (data) => {
          console.log('Server acknowledged connection:', data);
          if (data.status === 'success') {
            setConnectionStatus('ready');
          }
        });

        return newSocket;
      } catch (error) {
        console.error('Socket initialization error:', error);
        setConnectionStatus('error');
        return null;
      }
    };

    const newSocket = initializeSocket();

    return () => {
      if (newSocket) {
        console.log('Cleaning up socket connection');
        newSocket.off('connect');
        newSocket.off('connect_error');
        newSocket.off('disconnect');
        newSocket.off('details_ack');
        newSocket.close();
      }
    };
  }, [userId]);

  const contextValue = useMemo(() => ({
    socket,
    userId,
    SocketId,
    setSocketId,
    peerState,
    setpeerState,
    connectionStatus
  }), [socket, userId, SocketId, peerState, connectionStatus]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
