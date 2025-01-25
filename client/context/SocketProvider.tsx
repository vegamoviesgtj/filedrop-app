"use client";
import { customAlphabet, nanoid } from "nanoid";
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
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
  } = useContext(SocketContext);
  return socket;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socket = useMemo(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:8000';
    return io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5
    });
  }, []);

  const [peerState, setpeerState] = useState<any>();
  const [SocketId, setSocketId] = useState<any>();
  
  const userId = useMemo(() => nanoid(10), []);

  // Set socket ID when connected
  React.useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      setSocketId(socket.id);
    });

    return () => {
      socket.off('connect');
    };
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{ socket, userId, SocketId, setSocketId, peerState, setpeerState }}
    >
      {children}
    </SocketContext.Provider>
  );
};
