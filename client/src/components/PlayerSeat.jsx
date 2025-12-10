import { useState, useRef, useMemo } from 'react'
import PlayingCard from './PlayingCard'
import './PlayerSeat.css'

// Dynamically import all images from src/image folder using Vite's glob
// Use relative path pattern that Vite can resolve
const imageModules = import.meta.glob('../image/*.{png,jpg,jpeg}', { eager: true })
const availableImages = Object.values(imageModules).map(module => module.default)

// Fallback image (the original cat image from public folder)
const fallbackImage = '/image.png'

// Function to get a consistent image for a player based on their ID
function getPlayerImage(playerId) {
    if (!playerId || availableImages.length === 0) return fallbackImage

    // Simple hash function to convert playerId to a number
    let hash = 0
    for (let i = 0; i < playerId.length; i++) {
        const char = playerId.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }

    // Use absolute value and modulo to get index
    const index = Math.abs(hash) % availableImages.length
    return availableImages[index] || fallbackImage
}

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
    onKickPlayer,
    isHost,
    impactMarks = []
}) {
    const [showThrowMenu, setShowThrowMenu] = useState(false)
    const [menuPosition, setMenuPosition] = useState(null)
    const seatRef = useRef(null)
    
    // Get player's background image based on their ID (consistent for same player)
    // Must be called before any early returns (React Hook rules)
    const playerImage = useMemo(() => {
        // Hardcoded: Use lsr.png for player with nickname "老实人"
        if (player?.nickname === '老实人') {
            try {
                return new URL('../lsr.png', import.meta.url).href
            } catch (e) {
                console.error('Failed to load lsr.png:', e)
                // Fall through to default logic
            }
        }
        const playerId = player?.playerId || player?.socketId
        return getPlayerImage(playerId)
    }, [player?.playerId, player?.socketId, player?.nickname])
    
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
            // Show cards even if mucked - they remain visible until next hand
            if (showdownHand.holeCards && showdownHand.holeCards.length > 0) {
                cardsToShow = showdownHand.holeCards;
            } else if (isMe && holeCards.length > 0) {
                // Fallback to own cards if showdownHand doesn't have them
                cardsToShow = holeCards;
            }
        } else if (showdownHand.holeCards) {
            cardsToShow = showdownHand.holeCards;
            isWinner = showdownHand.isWinner;
            handRank = showdownHand.handRank;
        }
    } else if (isMe && holeCards.length > 0) {
        cardsToShow = holeCards;
    }

    // Timer logic - Combined action timer + timebank into one continuous bar
    const showTimer = isCurrentPlayer && timerState && timerState.playerId === player?.socketId;

    // Calculate total time and percentage for unified timer bar
    let timerPercent = 0;
    let isLowTime = false;
    let isTimeBank = false;

    // Calculate separate percentages for action timer and timebank
    let actionPercent = 0;
    let timebankPercent = 0;

    if (showTimer) {
        const actionTime = 30; // Action timer duration

        // During timebank phase, timebankRemaining might equal remaining
        // We need to use a fixed total time based on initial values
        let timebankTotal;
        let totalTime;

        if (timerState.usingTimeBank) {
            // In timebank: use remaining as the max timebank (first tick of timebank phase)
            // But totalTime should include the full action time too
            // Use ?? instead of || to allow 0 timebank
            timebankTotal = timerState.timebankRemaining ?? 60;
            totalTime = actionTime + timebankTotal;

            // Action time is done, show only timebank remaining
            actionPercent = 0;
            timebankPercent = (timerState.remaining / totalTime) * 100;
            isTimeBank = true;
        } else {
            // In action phase: timebank hasn't been touched yet
            // Use ?? instead of || to allow 0 timebank
            timebankTotal = timerState.timebankRemaining ?? 60;
            totalTime = actionTime + timebankTotal;

            // Show action time counting down + full timebank
            actionPercent = (timerState.remaining / totalTime) * 100;
            timebankPercent = (timebankTotal / totalTime) * 100;
            isTimeBank = false;
        }

        console.log('[TIMER-DEBUG]', {
            remaining: timerState.remaining,
            usingTimeBank: timerState.usingTimeBank,
            timebankRemaining: timerState.timebankRemaining,
            actionPercent: actionPercent.toFixed(1) + '%',
            timebankPercent: timebankPercent.toFixed(1) + '%',
            totalPercent: (actionPercent + timebankPercent).toFixed(1) + '%'
        });

        isLowTime = timerState.remaining <= 5;
        timerPercent = actionPercent + timebankPercent; // Total for countdown display
    }

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

    const impactClass = impactMarks && impactMarks.length > 0
        ? `impact-${impactMarks[impactMarks.length - 1].item}`
        : ''

    return (
        <div 
            ref={seatRef}
            className={`player-seat cat-seat ${isMe ? 'my-seat' : ''} ${isCurrentPlayer ? 'active-turn' : ''} ${isFolded ? 'folded' : ''} ${isWaiting ? 'waiting' : ''} ${isWinner ? 'winner' : ''} ${impactClass}`}
            onClick={openThrowMenu}
            data-player-id={player?.playerId || player?.socketId}
            data-socket-id={player?.socketId}
            style={{ 
                cursor: myPlayer && myPlayer.seatNumber !== null && !isMe ? 'pointer' : 'default',
                backgroundImage: 'none'
            }}
        >
            <img className="cat-bg" src={playerImage} alt="Player background" />
            {/* Timer Progress Bar - Combined timebank + action */}
            {showTimer && (
                <div className="seat-timer-container">
                    {/* Timebank bar (amber) - on the left */}
                    <div
                        className={`seat-timer-bar timebank-timer ${isLowTime && isTimeBank ? 'low-time' : ''}`}
                        style={{ width: `${Math.min(timebankPercent, 100)}%` }}
                    />
                    {/* Action timer bar (blue) - positioned after timebank */}
                    <div
                        className={`seat-timer-bar action-timer ${isLowTime && !isTimeBank ? 'low-time' : ''}`}
                        style={{
                            width: `${Math.min(actionPercent, 100)}%`,
                            left: `${Math.min(timebankPercent, 100)}%`
                        }}
                    />
                    <div className={`seat-timer-countdown ${isTimeBank ? 'time-bank' : ''}`}>
                        {Math.ceil(timerState.remaining)}s
                    </div>
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
                    {cardsToShow.length > 0 && (
                        <div className={`hole-cards ${isFolded ? 'folded' : ''} ${isMucked ? 'mucked' : ''}`}>
                            {cardsToShow.map((card, i) => (
                                <PlayingCard key={i} card={card} />
                            ))}
                        </div>
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

            {/* Kick button (only for host viewing other players) */}
            {isHost && !isMe && player && onKickPlayer && (
                <button
                    className="btn-kick-player"
                    onClick={(e) => {
                        e.stopPropagation();
                        const confirmed = window.confirm(
                            `Remove ${player.nickname} from their seat?${
                                isStandingUpNext
                                    ? '\n\n(Already marked to stand up after this hand)'
                                    : ''
                            }`
                        );
                        if (confirmed) {
                            onKickPlayer(player);
                        }
                    }}
                    title={isStandingUpNext ? "Player will stand up after this hand" : "Remove player from seat"}
                >
                    {isStandingUpNext ? '⚠' : '🚫'}
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

        </div>
    )
}
