import { useState, useRef } from 'react'
import PlayingCard from './PlayingCard'
import ThrowItemMenu from './ThrowItemMenu'
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
    isViewerSeated,
    myPlayer,
    onThrowItem,
    impactMarks = []
}) {
    const [showThrowMenu, setShowThrowMenu] = useState(false)
    const [menuPosition, setMenuPosition] = useState(null)
    const seatRef = useRef(null)
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

    const openThrowMenu = (e) => {
        console.log('Seat clicked:', {
            isMe,
            hasMyPlayer: !!myPlayer,
            mySeatNumber: myPlayer?.seatNumber,
            hasPlayer: !!player,
            playerSocketId: player?.socketId,
            playerId: player?.playerId,
            mySocketId: myPlayer?.socketId,
            myPlayerId: myPlayer?.playerId
        })
        
        // Only show throw menu if clicking on another player and we have myPlayer
        if (isMe || !myPlayer || !player) {
            console.log('Menu blocked - early return', { isMe, hasMyPlayer: !!myPlayer, hasPlayer: !!player, mySeat: myPlayer?.seatNumber })
            return
        }
        
        // Don't show menu if clicking on myself
        if (player.socketId === myPlayer.socketId || player.playerId === myPlayer.playerId) {
            console.log('Menu blocked - same player')
            return
        }

        // Stop event propagation
        e.stopPropagation()
        e.preventDefault()

        const rect = seatRef.current?.getBoundingClientRect()
        console.log('Seat rect:', rect)
        let position
        if (rect) {
            position = {
                x: rect.left + rect.width / 2,
                // Drop the menu below the seat so it stays visible on mobile/top rows
                y: rect.bottom + 8
            }
        } else {
            position = {
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            }
            console.log('No rect found, using viewport center fallback')
        }

        // Clamp to viewport to avoid being off-screen
        const clamped = {
            x: Math.min(Math.max(position.x, 12), window.innerWidth - 12),
            y: Math.min(Math.max(position.y, 12), window.innerHeight - 12)
        }
        console.log('Setting menu position (clamped):', clamped)
        setMenuPosition(clamped)
        setShowThrowMenu(true)
    }

    const handleItemSelect = (item) => {
        console.log('[THROW] handleItemSelect', { item, hasOnThrow: !!onThrowItem, hasPlayer: !!player })
        if (onThrowItem && player) {
            onThrowItem(item, player)
        }
        setShowThrowMenu(false)
    }

    // Debug helper: log when we intend to show the menu
    if (showThrowMenu) {
        console.debug('Throw menu should be visible', {
            menuPosition,
            targetNickname: player?.nickname,
            myNickname: myPlayer?.nickname,
            targetSocketId: player?.socketId,
            targetPlayerId: player?.playerId
        })
    }

    return (
        <div 
            ref={seatRef}
            className={`player-seat ${isMe ? 'my-seat' : ''} ${isCurrentPlayer ? 'active-turn' : ''} ${isFolded ? 'folded' : ''} ${isWaiting ? 'waiting' : ''} ${isWinner ? 'winner' : ''} ${impactMark ? `impact-${impactMark.item}` : ''}`}
            onClick={openThrowMenu}
            data-player-id={player?.playerId || player?.socketId}
            data-socket-id={player?.socketId}
            style={{ cursor: myPlayer && myPlayer.seatNumber !== null && !isMe ? 'pointer' : 'default' }}
        >
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
            <div className="player-info" onClick={(e) => e.stopPropagation()}>
                <div className="player-name">
                    {player.nickname}
                    {isMe && <span className="you-badge">YOU</span>}
                </div>
                <div className="player-chips mono">${player.chips}</div>
            </div>

            {/* Hole Cards or Mucked Status */}
            {!isWaiting && (
                <div className="hole-cards-container" onClick={(e) => e.stopPropagation()}>
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

            {/* Throw button overlay for clarity */}
            {!isMe && myPlayer && (
                <button
                    type="button"
                    className="btn-throw-item"
                    onClick={(e) => {
                        e.stopPropagation();
                        openThrowMenu(e);
                    }}
                    title={`Throw item at ${player.nickname}`}
                >
                    🎯
                </button>
            )}

            {/* Impact Mark */}
            {impactMarks && impactMarks.length > 0 && impactMarks.map((impactMark, idx) => (
                <div
                    key={impactMark.id || idx}
                    className={`impact-mark impact-${impactMark.item}`}
                    style={{ transform: `translate(-50%, -50%) translate(${idx * 6}px, ${-idx * 6}px)` }}
                >
                    {/* Distinct impact icons (not the thrown item itself) */}
                    {impactMark.item === 'tomato' && '💥'}
                    {impactMark.item === 'egg' && '🐣'}
                    {impactMark.item === 'flipflops' && '🩴'}
                    {impactMark.item === 'boom' && '💥'}
                </div>
            ))}

            {/* Inline fallback menu to guarantee access if popup is off-screen */}
            {showThrowMenu && (
                <div
                    className="throw-menu-inline-fallback"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="fallback-title">Throw at {player.nickname}</div>
                    <div className="fallback-buttons">
                        {[
                            { id: 'tomato', label: '🍅' },
                            { id: 'egg', label: '🥚' },
                            { id: 'flipflops', label: '🩴' },
                            { id: 'boom', label: '💣' },
                        ].map(item => (
                            <button
                                key={item.id}
                                type="button"
                                className="fallback-throw-btn"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleItemSelect({ id: item.id })
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Throw Item Menu */}
            {showThrowMenu && menuPosition && (
                <ThrowItemMenu
                    targetPlayer={player}
                    myPlayer={myPlayer}
                    onItemSelect={handleItemSelect}
                    onClose={() => setShowThrowMenu(false)}
                    position={menuPosition}
                />
            )}
        </div>
    )
}
