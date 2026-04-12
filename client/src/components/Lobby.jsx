import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import GameSettings from './GameSettings'
import './Lobby.css'

export default function Lobby() {
    const [showSettings, setShowSettings] = useState(false)
    const [joinRoomId, setJoinRoomId] = useState('')
    const navigate = useNavigate()
    const { connect } = useSocket()

    const handleCreateGame = async (settings) => {
        try {
            const apiUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
            const response = await fetch(`${apiUrl}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            })

            const data = await response.json()

            // Connect to socket server after room is created
            connect()

            navigate(`/room/${data.roomId}`)
        } catch (error) {
            console.error('Failed to create room:', error)
            alert('Failed to create game. Please try again.')
        }
    }

    const handleJoinGame = () => {
        if (joinRoomId.trim()) {
            navigate(`/room/${joinRoomId.trim()}`)
        }
    }

    return (
        <div className="lobby">
            <div className="lobby-content">
                <div className="lobby-header">
                    <h1 className="lobby-title">
                        老实德州
                    </h1>
                    <p className="lobby-subtitle">
                        Private Texas Hold'em • Play with Friends
                    </p>
                </div>

                <div className="lobby-actions">
                    <div 
                        className="action-card action-card-clickable"
                        onClick={() => setShowSettings(true)}
                        onKeyDown={(e) => e.key === 'Enter' && setShowSettings(true)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="action-icon">🎮</div>
                        <h3>Create New Game</h3>
                        <p className="text-muted">
                            Host a private table and invite your friends
                        </p>
                    </div>

                    <div 
                        className="action-card action-card-clickable"
                        onClick={handleJoinGame}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinGame()}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="action-icon">🔗</div>
                        <h3>Join Game</h3>
                        <p className="text-muted">
                            Enter room code to join an existing game
                        </p>
                        <div className="join-form" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter room code"
                                value={joinRoomId}
                                onChange={(e) => setJoinRoomId(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
                            />
                        </div>
                    </div>
                </div>

                <div className="lobby-features">
                    <div className="feature">
                        <span className="feature-icon">⚡</span>
                        <span>Real-time gameplay</span>
                    </div>
                    <div className="feature">
                        <span className="feature-icon">🎯</span>
                        <span>Run It Twice</span>
                    </div>
                    <div className="feature">
                        <span className="feature-icon">🐰</span>
                        <span>Rabbit Hunt</span>
                    </div>
                    <div className="feature">
                        <span className="feature-icon">💬</span>
                        <span>In-game chat</span>
                    </div>
                </div>
            </div>

            {showSettings && (
                <GameSettings
                    onClose={() => setShowSettings(false)}
                    onSubmit={handleCreateGame}
                />
            )}
        </div>
    )
}
