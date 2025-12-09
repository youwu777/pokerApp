import PlayingCard from './PlayingCard'
import './PlayerSeat.css'

export default function PlayerSeat({
    player,
    seatNumber,
    isMe,
    holeCards,
    showdownHand,
    timerState,
    dealerPosition,
    totalPlayers,
    onSitDown,
    onStandUp,
    isCurrentPlayer,
    isViewerSeated
}) {
    if (!player) {
        if (isViewerSeated) {
            return <div className="player-seat empty-seat disabled"></div>;
        }
        return (
            <div className="player-seat empty-seat">
                <button className="btn btn-ghost btn-sm" onClick={onSitDown}>
                    Sit Here
                </button>
            </div>
        )
    }

    // Use backend-provided position and status
    const isDealer = player.position === 'BTN';
    const isFolded = player.status === 'folded';
    const isAllIn = player.status === 'all-in';
    const isWaiting = player.status === 'waiting-next-hand';
    const positionName = player.position;
    const isStandingUpNext = player.standUpNextHand;

    // Determine cards to show
    let cardsToShow = [];
    let isMucked = false;
    let isWinner = false;
    let handRank = null;

    if (showdownHand) {
        if (showdownHand.isMucked) {
            isMucked = true;
        } else if (showdownHand.holeCards) {
            cardsToShow = showdownHand.holeCards;
            isWinner = showdownHand.isWinner;
            handRank = showdownHand.handRank;
        }
    } else if (isMe && holeCards.length > 0) {
        cardsToShow = holeCards;
    }

    // Timer logic
    const showTimer = isCurrentPlayer && timerState && timerState.playerId === player?.socketId;
    const timerPercent = showTimer ? (timerState.remaining / 30) * 100 : 0; // Assuming 30s max for now, or pass max time
    const isLowTime = showTimer && timerState.remaining <= 5;
    const isTimeBank = showTimer && timerState.usingTimeBank;

    return (
        <div className={`player-seat ${isMe ? 'my-seat' : ''} ${isCurrentPlayer ? 'active-turn' : ''} ${isFolded ? 'folded' : ''} ${isWaiting ? 'waiting' : ''} ${isWinner ? 'winner' : ''}`}>
            {/* Timer Progress Bar */}
            {showTimer && (
                <div className="seat-timer-container">
                    <div
                        className={`seat-timer-bar ${isLowTime ? 'low-time' : ''} ${isTimeBank ? 'time-bank' : ''}`}
                        style={{ width: `${Math.min(timerPercent, 100)}%` }}
                    />
                </div>
            )}

            {/* Waiting Overlay */}
            {isWaiting && (
                <div className="waiting-overlay">
                    <span>Waiting for next hand...</span>
                </div>
            )}

            {/* Dealer Button */}
            {isDealer && !isWaiting && (
                <div className="dealer-button">D</div>
            )}

            {/* Position Label */}
            {positionName && !isWaiting && (
                <div className="position-label">{positionName}</div>
            )}

            {/* Player Info */}
            <div className="player-info">
                <div className="player-name">
                    {player.nickname}
                    {isMe && <span className="you-badge">YOU</span>}
                </div>
                <div className="player-chips mono">${player.chips}</div>
            </div>

            {/* Hole Cards or Mucked Status */}
            {!isWaiting && (
                <div className="hole-cards-container">
                    {isMucked ? (
                        <div className="mucked-cards">
                            <span className="text-xs text-gray-400">Mucked</span>
                        </div>
                    ) : (
                        cardsToShow.length > 0 && (
                            <div className="hole-cards">
                                {cardsToShow.map((card, i) => (
                                    <PlayingCard key={i} card={card} />
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Hand Rank Label (for winner/showdown) */}
            {handRank && (
                <div className="hand-rank-label">
                    {handRank}
                </div>
            )}

            {/* Current Bet with Action Badges */}
            {!isWaiting && (
                <div className="current-bet-container">
                    {/* Status Badges - Left side */}
                    <div className="player-badges">
                        {isAllIn && <div className="badge all-in-badge">ALL IN</div>}
                        {player.lastAction && !isFolded && !isAllIn &&
                            player.lastAction !== 'small blind' && player.lastAction !== 'big blind' && player.lastAction !== 'all-in' && (
                                <div className="badge action-badge">
                                    {player.lastAction.startsWith('bet') ? 'Bet' : 
                                     player.lastAction.startsWith('raise') ? 'Raise' : 
                                     player.lastAction === 'check' ? 'Check' :
                                     player.lastAction === 'call' ? 'Call' :
                                     player.lastAction === 'fold' ? 'Fold' :
                                     player.lastAction.charAt(0).toUpperCase() + player.lastAction.slice(1)}
                                </div>
                            )}
                        {isStandingUpNext && (
                            <div className="badge stand-up-badge">LEAVING NEXT</div>
                        )}
                    </div>
                    {/* Betting Size - Right side */}
                    {player.currentBet > 0 && (
                        <div className="current-bet">
                            <div className="bet-chips mono">${player.currentBet}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Stand Up (only for me) */}
            {isMe && (
                <button
                    className={`btn-stand-up ${isStandingUpNext ? 'active' : ''}`}
                    onClick={onStandUp}
                    title={isStandingUpNext ? "Cancel Stand Up" : "Stand Up"}
                >
                    {isStandingUpNext ? '↩' : '×'}
                </button>
            )}
        </div>
    )
}
