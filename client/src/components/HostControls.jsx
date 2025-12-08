import { useState } from 'react'
import GameSettings from './GameSettings'
import './HostControls.css'

export default function HostControls({ roomState, socket }) {
  const [showSettings, setShowSettings] = useState(false)

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
