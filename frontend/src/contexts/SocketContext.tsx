import React, { createContext, useEffect, useState } from "react";
import { Socket, io } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const SocketContext = createContext<SocketContextType | undefined>(
  undefined,
);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = () => {
    if (socket) return; // Already have a socket

    const newSocket = io("/");

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    newSocket.on("connect", onConnect);
    newSocket.on("disconnect", onDisconnect);

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (!socket) return;

    socket.disconnect();
    setSocket(null);
    setIsConnected(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, connect, disconnect }}
    >
      {children}
    </SocketContext.Provider>
  );
}
