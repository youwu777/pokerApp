import { useState, useEffect } from 'react'
import GameSettings from './GameSettings'
import './HostControls.css'

export default function HostControls({ roomState, socket }) {
  const [showSettings, setShowSettings] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  // Listen for game stop events to reset the stopping state
  useEffect(() => {
    if (!socket) return

    const handleGameStopped = () => {
      setIsStopping(false)
    }

    const handleGameEnded = () => {
      setIsStopping(false)
    }

    socket.on('game-stopped', handleGameStopped)
    socket.on('game-ended', handleGameEnded)

    return () => {
      socket.off('game-stopped', handleGameStopped)
      socket.off('game-ended', handleGameEnded)
    }
  }, [socket])

  const handleStartHand = () => {
    socket.emit('start-hand')
  }

  const handlePause = () => {
    socket.emit('pause-game')
  }

  const handleUpdateSettings = (settings) => {
    socket.emit('update-settings', { settings })
    setShowSettings(false)
  }

  const handleStopGame = () => {
    const hasActiveHand = roomState.gameState && roomState.gameState.bettingRound
    const message = hasActiveHand 
      ? 'Stop game after this hand completes?' 
      : 'Stop the game?'
    
    if (window.confirm(message)) {
      setIsStopping(true)
      socket.emit('stop-game')
    }
  }

  const seatedPlayers = roomState.players.filter(p => p.seatNumber !== null).length
  const canStart = seatedPlayers >= 2

  return (
    <div className="host-controls">
      {!roomState.gameState && (
        <button
          className="btn btn-primary btn-sm start-game-btn"
          onClick={handleStartHand}
          disabled={!canStart}
        >
          🎮 Start Game ({seatedPlayers}/2)
        </button>
      )}

      {roomState.gameState && (
        <button
          className="btn btn-danger btn-sm"
          onClick={handleStopGame}
          disabled={isStopping}
        >
          🛑 Stop Game
        </button>
      )}

      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setShowSettings(true)}
      >
        ⚙️ Settings
      </button>

      {showSettings && (
        <GameSettings
          onClose={() => setShowSettings(false)}
          onSubmit={handleUpdateSettings}
        />
      )}
    </div>
  )
}
