import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)

export function useSocket() {
    const context = useContext(SocketContext)
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider')
    }
    return context
}

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null)
    const [connected, setConnected] = useState(false)

    const connect = () => {
        if (socket) {
            // Socket already exists, just connect if not connected
            if (!socket.connected) {
                socket.connect()
            }
            return
        }

        // Create new socket with autoConnect disabled
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const newSocket = io(serverUrl, {
            autoConnect: false
        })

        newSocket.on('connect', () => {
            console.log('Connected to server')
            setConnected(true)
        })

        newSocket.on('disconnect', () => {
            console.log('Disconnected from server')
            setConnected(false)
        })

        setSocket(newSocket)

        // Connect immediately after setup
        newSocket.connect()
    }

    useEffect(() => {
        return () => {
            if (socket) {
                socket.close()
            }
        }
    }, [socket])

    return (
        <SocketContext.Provider value={{ socket, connected, connect }}>
            {children}
        </SocketContext.Provider>
    )
}
