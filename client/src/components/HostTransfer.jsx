import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './HostTransfer.css'

export default function HostTransfer({ socket, isHost, roomState, onClose }) {
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [showConfirm, setShowConfirm] = useState(false)
    
    // Get active players (excluding current host)
    const activePlayers = roomState?.players?.filter(player => 
        player.socketId !== socket?.id && player.nickname
    ) || []
    
    const handlePlayerSelect = (player) => {
        setSelectedPlayer(player)
        setShowConfirm(true)
    }
    
    const handleConfirmTransfer = () => {
        if (socket && selectedPlayer) {
            socket.emit('transfer-host', { newHostPlayerId: selectedPlayer.playerId })
            setShowConfirm(false)
            onClose()
        }
    }
    
    const handleCancel = () => {
        setShowConfirm(false)
        setSelectedPlayer(null)
    }
    
    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content host-transfer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Transfer Room Ownership</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    {showConfirm && selectedPlayer ? (
                        <div className="confirm-section">
                            <p>Are you sure you want to transfer room ownership to <strong>{selectedPlayer.nickname}</strong>?</p>
                            <p>This action cannot be undone.</p>
                            <div className="confirm-actions">
                                <button className="btn btn-success" onClick={handleConfirmTransfer}>
                                    Confirm Transfer
                                </button>
                                <button className="btn btn-ghost" onClick={handleCancel}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="player-list">
                            <h3>Select New Host:</h3>
                            {activePlayers.length > 0 ? (
                                <div className="player-buttons">
                                    {activePlayers.map(player => (
                                        <button
                                            key={player.playerId || player.socketId}
                                            className="btn btn-primary player-btn"
                                            onClick={() => handlePlayerSelect(player)}
                                        >
                                            {player.nickname}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="no-players">No active players available to transfer ownership to.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}