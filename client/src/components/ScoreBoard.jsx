import { useState } from 'react'
import './ScoreBoard.css'

export default function ScoreBoard({ players }) {
    const [isExpanded, setIsExpanded] = useState(false)

    // Calculate P/L for each player
    const playersWithPL = players.map(player => {
        const buyin = player.buyin || 0
        const currentStack = player.stack || 0
        const profitLoss = currentStack - buyin
        const isActive = player.isActive !== false // Default to true if not specified (for backward compatibility)
        
        return {
            ...player,
            buyin,
            currentStack,
            profitLoss,
            isActive
        }
    })

    // Sort by profit/loss (highest first), then active players first
    const sortedPlayers = [...playersWithPL].sort((a, b) => {
        if (a.isActive !== b.isActive) {
            return a.isActive ? -1 : 1; // Active players first
        }
        return b.profitLoss - a.profitLoss;
    })

    return (
        <>
            <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsExpanded(true)}
            >
                Score
            </button>

            {isExpanded && (
                <div className="modal-overlay" onClick={() => setIsExpanded(false)}>
                    <div className="scoreboard-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="scoreboard-header">
                            <h4>Scoreboard</h4>
                            <button 
                                className="btn-close" 
                                onClick={() => setIsExpanded(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="scoreboard-table">
                            <div className="scoreboard-row header">
                                <div className="col-name">Player</div>
                                <div className="col-buyin">Buyin</div>
                                <div className="col-stack">Stack</div>
                                <div className="col-pl">P/L</div>
                            </div>
                            {sortedPlayers.map((player) => (
                                <div 
                                    key={player.socketId} 
                                    className={`scoreboard-row ${!player.isActive ? 'inactive' : ''}`}
                                >
                                    <div className="col-name">
                                        {player.nickname}
                                        {player.isActive && (player.seatNumber !== null || player.seatNumber !== undefined) && (
                                            <span className="seated-badge">●</span>
                                        )}
                                        {!player.isActive && (
                                            <span className="inactive-badge">(Left)</span>
                                        )}
                                    </div>
                                    <div className="col-buyin mono">${player.buyin}</div>
                                    <div className="col-stack mono">${player.currentStack}</div>
                                    <div className={`col-pl mono ${player.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                                        {player.profitLoss >= 0 ? '+' : ''}${player.profitLoss}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

