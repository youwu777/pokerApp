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

    useEffect(() => {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const newSocket = io(serverUrl, {
            autoConnect: true
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

        return () => {
            newSocket.close()
        }
    }, [])

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    )
}
