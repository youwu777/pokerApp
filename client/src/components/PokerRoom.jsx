import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import PokerTable from './PokerTable'
import ActionPanel from './ActionPanel'
import Chat from './Chat'
import HostControls from './HostControls'
import BuyInRequest from './BuyInRequest'
import BuyInNotification from './BuyInNotification'
import ScoreBoard from './ScoreBoard'
import ItemAnimation from './ItemAnimation'
import CoinAnimation from './CoinAnimation'
import ChatBubble from './ChatBubble'
import soundManager from '../utils/sounds'
import './PokerRoom.css'

export default function PokerRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { socket, connect } = useSocket()

    const [nickname, setNickname] = useState('')
    const [buyinAmount, setBuyinAmount] = useState(1000)
    const [joined, setJoined] = useState(false)
    const [roomState, setRoomState] = useState(null)
    const [myPlayer, setMyPlayer] = useState(null)
    const myPlayerRef = useRef(null) // Ref to track myPlayer for sound effects
    const isMyTurnRef = useRef(false) // Ref to track if it's currently my turn
    const [isHost, setIsHost] = useState(false)
    const [holeCards, setHoleCards] = useState([])
    const [showdownHands, setShowdownHands] = useState([])
    const [handWinners, setHandWinners] = useState([]) // Winners from any hand completion
    const [timerState, setTimerState] = useState(null)
    const [error, setError] = useState(null)
    const [roomNotFound, setRoomNotFound] = useState(false)
    const [visibleCommunityCards, setVisibleCommunityCards] = useState([])
    const [showChat, setShowChat] = useState(false)
    const [checkingRoom, setCheckingRoom] = useState(true)
    const [chatMessages, setChatMessages] = useState([])
    const [activeAnimations, setActiveAnimations] = useState([])
    const [impactMarks, setImpactMarks] = useState({})
    const [activeChatBubbles, setActiveChatBubbles] = useState([])

    // Get session token from localStorage
    const getSessionToken = () => {
        try {
            return localStorage.getItem(`sessionToken_${roomId}`)
        } catch (e) {
            console.warn('localStorage not available:', e)
            return null
        }
    }

    const getStoredPlayerId = () => {
        try {
            return localStorage.getItem(`playerId_${roomId}`)
        } catch (e) {
            console.warn('localStorage not available:', e)
            return null
        }
    }

    const savePlayerId = (id) => {
        try {
            if (id) {
                localStorage.setItem(`playerId_${roomId}`, id)
            }
        } catch (e) {
            console.warn('Failed to save playerId to localStorage:', e)
        }
    }

    // Get stored nickname from localStorage
    const getStoredNickname = () => {
        try {
            return localStorage.getItem(`nickname_${roomId}`)
        } catch (e) {
            console.warn('localStorage not available:', e)
            return null
        }
    }

    // Save session token to localStorage
    const saveSessionToken = (token) => {
        try {
            if (token) {
                localStorage.setItem(`sessionToken_${roomId}`, token)
            } else {
                localStorage.removeItem(`sessionToken_${roomId}`)
            }
        } catch (e) {
            console.warn('Failed to save sessionToken to localStorage:', e)
        }
    }

    // Save nickname to localStorage
    const saveNickname = (name) => {
        try {
            if (name) {
                localStorage.setItem(`nickname_${roomId}`, name)
            } else {
                localStorage.removeItem(`nickname_${roomId}`)
            }
        } catch (e) {
            console.warn('Failed to save nickname to localStorage:', e)
        }
    }

    useEffect(() => {
        if (!socket) return

        // Socket event listeners
        socket.on('room-joined', (data) => {
            setJoined(true)
            setIsHost(data.isHost)
            setRoomState(data.roomState)
            setCheckingRoom(false) // Room check complete, we're joined
            // Prime myPlayer immediately to avoid timing gaps for UI that depends on it
            if (data.roomState?.players) {
                const me = data.roomState.players.find(p => p.socketId === socket.id) ||
                    data.roomState.players.find(p => p.sessionToken === getSessionToken()) ||
                    data.roomState.players.find(p => p.playerId && p.playerId === getStoredPlayerId())
                if (me) {
                    setMyPlayer(me)
                    if (me.playerId) savePlayerId(me.playerId)
                }
            }
            // Load chat history from room state if available
            if (data.roomState?.chatHistory) {
                setChatMessages(data.roomState.chatHistory)
            }
            // Save sessionToken and nickname for reconnection
            if (data.sessionToken) {
                saveSessionToken(data.sessionToken)
            }
            // Extract and save nickname from roomState
            if (data.roomState?.players) {
                const myPlayer = data.roomState.players.find(p => p.socketId === socket.id)
                if (myPlayer?.nickname) {
                    saveNickname(myPlayer.nickname)
                    setNickname(myPlayer.nickname) // Update state with stored nickname
                }
            }
        })

        socket.on('room-state', (state) => {
            setRoomState(state)
            // Update visible community cards if game state exists
            if (state?.gameState?.communityCards) {
                setVisibleCommunityCards(state.gameState.communityCards)
            }
            // Update chat messages if chat history is included
            if (state?.chatHistory) {
                setChatMessages(state.chatHistory)
            }
            // Update chat bubbles when room state changes (to get updated player info)
            setActiveChatBubbles(prev => prev.map(bubble => {
                const sender = state?.players?.find(p => 
                    p.socketId === bubble.playerId || 
                    p.playerId === bubble.playerId
                )
                if (sender && sender.seatNumber !== null) {
                    return { ...bubble, seatNumber: sender.seatNumber }
                }
                return bubble
            }))
        })

        socket.on('player-joined', ({ player }) => {
            console.log(`${player.nickname} joined`)
        })

        socket.on('player-left', ({ nickname }) => {
            console.log(`${nickname} left`)
        })

        socket.on('deal-cards', ({ holeCards }) => {
            console.log('Received hole cards:', holeCards)
            setHoleCards(holeCards)
            setShowdownHands([]) // Clear showdown hands on new deal
            setHandWinners([]) // Clear winners on new deal
        })

        socket.on('new-hand', ({ gameState, roomState }) => {
            setRoomState(roomState)
            setShowdownHands([]) // Clear showdown hands
            setHandWinners([]) // Clear winners - important to clear so coin animation doesn't run during active game
            setVisibleCommunityCards([]) // Reset visible community cards
            // Cards will be set by deal-cards event
        })

        socket.on('player-acted', ({ playerId, action, gameState, roomState }) => {
            setRoomState(roomState)
            // Update visible community cards to match game state
            if (gameState && gameState.communityCards) {
                setVisibleCommunityCards(gameState.communityCards)
            }
            // Clear timer state and turn tracking when player acts
            setTimerState(null)
            isMyTurnRef.current = false
            
            // Play sound if it's your action (use ref to avoid stale closure)
            const me = myPlayerRef.current
            if (playerId === socket.id || (me && (playerId === me.socketId || playerId === me.playerId))) {
                if (action === 'check') {
                    soundManager.playCheck()
                } else if (action === 'fold') {
                    soundManager.playFoldTimeout()
                } else if (action === 'call' || action === 'bet' || action === 'raise' || action === 'all-in') {
                    soundManager.playCallRaise()
                }
            }
        })

        socket.on('card-reveal', ({ card, cardIndex, gameState, roomState }) => {
            console.log(`Card revealed: ${card} at index ${cardIndex}`)
            setRoomState(roomState)
            // Update visible community cards progressively
            setVisibleCommunityCards(prev => {
                const newCards = [...prev]
                // Ensure we have enough slots
                while (newCards.length <= cardIndex) {
                    newCards.push(null)
                }
                newCards[cardIndex] = card
                return newCards
            })
        })

        socket.on('timer-tick', (data) => {
            const wasMyTurn = isMyTurnRef.current
            setTimerState(data)

            // Check if it's my turn
            const me = myPlayerRef.current
            const isMyTurn = data.playerId === socket.id || (me && (data.playerId === me.playerId || data.playerId === me.sessionToken))

            // Update ref
            isMyTurnRef.current = isMyTurn

            // Play sound only when turn STARTS (wasMyTurn false -> isMyTurn true)
            if (isMyTurn && !wasMyTurn) {
                soundManager.playYourTurn()
            }
        })

        socket.on('player-timeout', ({ playerId }) => {
            console.log(`Player ${playerId} timed out`)
            setTimerState(null)
            // Play sound if it's your timeout (use ref to avoid stale closure)
            const me = myPlayerRef.current
            if (playerId === socket.id || (me && (playerId === me.socketId || playerId === me.playerId))) {
                soundManager.playFoldTimeout()
            }
        })

        socket.on('hand-complete', ({ results, roomState }) => {
            setRoomState(roomState)
            // Keep hole cards visible until next hand starts
            setTimerState(null) // Clear timer
            isMyTurnRef.current = false // Reset turn tracking
            // Update visible community cards to show all cards
            if (roomState?.gameState?.communityCards) {
                setVisibleCommunityCards(roomState.gameState.communityCards)
            }
            if (results.revealedHands) {
                setShowdownHands(results.revealedHands)
            }
            // Store winners for coin animation (works for both showdown and non-showdown)
            // Set winners if they exist (hand-complete event means hand is over)
            if (results.winners && results.winners.length > 0) {
                setHandWinners(results.winners)
            }
        })

        socket.on('chat-message', (message) => {
            // Store chat messages in parent component to persist across modal open/close
            setChatMessages(prev => [...prev, message])
            
            // Find the player who sent the message and show/update chat bubble
            setRoomState(currentState => {
                if (currentState?.players) {
                    const sender = currentState.players.find(p => 
                        p.socketId === message.playerId || 
                        p.playerId === message.playerId
                    )
                    
                    if (sender && sender.seatNumber !== null) {
                        setActiveChatBubbles(prev => {
                            // Check if there's already a bubble for this seat
                            const existingBubbleIndex = prev.findIndex(bubble => 
                                bubble.seatNumber === sender.seatNumber &&
                                (bubble.playerId === message.playerId || bubble.playerId === sender.socketId || bubble.playerId === sender.playerId)
                            )
                            
                            if (existingBubbleIndex >= 0) {
                                // Update existing bubble with new message and reset timer
                                const updatedBubbles = [...prev]
                                updatedBubbles[existingBubbleIndex] = {
                                    ...updatedBubbles[existingBubbleIndex],
                                    message,
                                    updatedAt: Date.now() // Signal to reset timer
                                }
                                return updatedBubbles
                            } else {
                                // Create new bubble
                                const bubbleId = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`
                                return [...prev, {
                                    id: bubbleId,
                                    message,
                                    playerId: message.playerId,
                                    seatNumber: sender.seatNumber,
                                    updatedAt: Date.now()
                                }]
                            }
                        })
                    }
                }
                return currentState
            })
        })

        socket.on('item-thrown', ({ fromPlayerId, targetPlayerId, fromSocketId, targetSocketId, itemId }) => {
            // Play sound when item is thrown
            soundManager.playThrowItem()
            
            // Snapshot positions at emit-time to avoid later recalcs moving earlier throws
            const getSeatCenter = (pid, sid) => {
                const el = document.querySelector(`[data-player-id="${pid}"], [data-socket-id="${sid}"]`)
                if (!el) return null
                const r = el.getBoundingClientRect()
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
            }

            const fromPosition = getSeatCenter(fromPlayerId, fromSocketId)
            const toPosition = getSeatCenter(targetPlayerId, targetSocketId)

            const animationId = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
            setActiveAnimations(prev => [...prev, {
                id: animationId,
                item: { id: itemId },
                fromPlayerId,
                targetPlayerId,
                fromSocketId,
                targetSocketId,
                fromPosition,
                toPosition
            }])
        })

        socket.on('rabbit-hunt-revealed', ({ cards, communityCardsIfDealt, gameState }) => {
            setRoomState(prev => ({
                ...prev,
                gameState: gameState
            }))
        })

        socket.on('game-stopped', ({ roomState: newRoomState }) => {
            setRoomState(newRoomState)
            setTimerState(null)
            setHandWinners([])
            setShowdownHands([])
        })

        socket.on('game-ended', ({ roomState: newRoomState }) => {
            setRoomState(newRoomState)
            setTimerState(null)
            setHandWinners([])
            setShowdownHands([])
        })

        socket.on('game-stopping', ({ roomState: newRoomState }) => {
            setRoomState(newRoomState)
        })

        socket.on('error', ({ message }) => {
            if (message === 'Room not found') {
                setRoomNotFound(true)
            } else {
                setError(message)
                setTimeout(() => setError(null), 5000)
            }
        })

        // Handle socket reconnection - automatically rejoin with stored sessionToken
        socket.on('connect', () => {
            if (joined && nickname.trim()) {
                const sessionToken = getSessionToken()
                const buyin = parseInt(buyinAmount, 10) || 1000
                console.log('Socket reconnected, rejoining room with sessionToken:', sessionToken)
                socket.emit('join-room', {
                    roomId,
                    nickname: nickname.trim(),
                    buyinAmount: buyin,
                    sessionToken: sessionToken
                })
            }
        })

        return () => {
            socket.off('room-joined')
            socket.off('room-state')
            socket.off('player-joined')
            socket.off('player-left')
            socket.off('deal-cards')
            socket.off('new-hand')
            socket.off('player-acted')
            socket.off('timer-tick')
            socket.off('player-timeout')
            socket.off('hand-complete')
            socket.off('chat-message')
            socket.off('item-thrown')
            socket.off('rabbit-hunt-revealed')
            socket.off('game-stopped')
            socket.off('game-ended')
            socket.off('game-stopping')
            socket.off('error')
            socket.off('connect')
        }
    }, [socket, joined, nickname, buyinAmount, roomId])



    // Update myPlayer when roomState changes
    useEffect(() => {
        if (roomState && socket) {
            const sessionToken = getSessionToken()
            const storedPlayerId = getStoredPlayerId()
            const player = roomState.players.find(p => p.socketId === socket.id)
                || roomState.players.find(p => p.sessionToken && p.sessionToken === sessionToken)
                || roomState.players.find(p => p.playerId && p.playerId === storedPlayerId)
            if (player) {
                setMyPlayer(player)
                if (player.playerId) savePlayerId(player.playerId)
            }
        }
    }, [roomState, socket])

    // Check if room exists and attempt auto-reconnect on mount
    useEffect(() => {
        const checkRoomAndReconnect = async () => {
            setCheckingRoom(true)

            // First, check if room exists via API
            try {
                const apiUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
                const response = await fetch(`${apiUrl}/api/rooms/${roomId}`)

                if (!response.ok) {
                    // Room doesn't exist, redirect to home
                    setRoomNotFound(true)
                    setCheckingRoom(false)
                    setTimeout(() => navigate('/'), 2000)
                    return
                }

                // Room exists, connect to socket server
                connect()

                // Now check if we can auto-reconnect
                const sessionToken = getSessionToken()
                const storedNickname = getStoredNickname()
                
                if (sessionToken && storedNickname) {
                    // Wait for socket to be connected if not already
                    if (socket) {
                        if (socket.connected) {
                            // Socket is connected, reconnect immediately
                            console.log('Auto-reconnecting with sessionToken:', sessionToken, 'nickname:', storedNickname)
                            setNickname(storedNickname)
                            socket.emit('join-room', {
                                roomId,
                                nickname: storedNickname,
                                buyinAmount: 1000, // Default, won't be used if player already exists
                                sessionToken: sessionToken
                            })
                            // Don't set checkingRoom to false yet - wait for room-joined event
                        } else {
                            // Socket not connected yet, wait for connection
                            const onConnect = () => {
                                console.log('Socket connected, auto-reconnecting...')
                                setNickname(storedNickname)
                                socket.emit('join-room', {
                                    roomId,
                                    nickname: storedNickname,
                                    buyinAmount: 1000,
                                    sessionToken: sessionToken
                                })
                                socket.off('connect', onConnect)
                            }
                            socket.on('connect', onConnect)
                        }
                    } else {
                        // No socket yet, show join form
                        setCheckingRoom(false)
                    }
                } else {
                    // No stored credentials, show join form
                    setCheckingRoom(false)
                }
            } catch (error) {
                console.error('Error checking room:', error)
                setRoomNotFound(true)
                setCheckingRoom(false)
                setTimeout(() => navigate('/'), 2000)
            }
        }
        
        checkRoomAndReconnect()
    }, [roomId, socket, navigate, connect])

    const handleJoinRoom = (e) => {
        e.preventDefault()
        if (nickname.trim() && socket) {
            const buyin = parseInt(buyinAmount, 10) || 1000
            const sessionToken = getSessionToken()
            console.log('Joining room with buyin:', buyin, 'sessionToken:', sessionToken)
            socket.emit('join-room', {
                roomId,
                nickname: nickname.trim(),
                buyinAmount: buyin,
                sessionToken: sessionToken
            })
        }
    }

    const handleSitDown = (seatNumber) => {
        if (socket) {
            socket.emit('sit-down', { seatNumber })
        }
    }

    const handleStandUp = () => {
        if (socket) {
            socket.emit('stand-up')
        }
    }

    const handlePlayerAction = (action, amount = 0) => {
        if (socket) {
            // Play sound immediately for local feedback
            if (action === 'check') {
                soundManager.playCheck()
            } else if (action === 'fold') {
                soundManager.playFoldTimeout()
            } else if (action === 'call' || action === 'bet' || action === 'raise' || action === 'all-in') {
                soundManager.playCallRaise()
            }
            socket.emit('player-action', { action, amount })
        }
    }

    const handleThrowItem = (item, targetPlayer) => {
        if (!socket || !targetPlayer) return

        console.log('[THROW] emitting', { item: item.id, targetPlayerId: targetPlayer.playerId, targetSocketId: targetPlayer.socketId })

        // Emit throw item event
        socket.emit('throw-item', {
            itemId: item.id,
            targetPlayerId: targetPlayer.playerId || targetPlayer.socketId,
            targetSocketId: targetPlayer.socketId
        })
    }

    const handleTriggerRabbitHunt = () => {
        if (socket) {
            socket.emit('rabbit-hunt')
        }
    }

    const handleKickPlayer = (targetPlayer) => {
        if (socket && targetPlayer) {
            socket.emit('kick-player', targetPlayer.socketId)
        }
    }

    // Show loading while checking room
    if (checkingRoom) {
        return (
            <div className="poker-room">
                <div className="loading">Checking room...</div>
            </div>
        )
    }

    // Show room not found modal
    if (roomNotFound) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div className="modal-header">
                        <h2>Room Not Found</h2>
                    </div>
                    <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
                        <p style={{ fontSize: '1.1rem', marginBottom: 'var(--space-lg)', color: 'var(--color-text)' }}>
                            The room you're trying to join doesn't exist or has been closed.
                        </p>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => navigate('/')}
                        >
                            Back to Lobby
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // Show join form only if not joined and room exists
    if (!joined) {
        return (
            <div className="poker-room join-screen">
                <div className="join-card">
                    <h2>Join Game</h2>
                    <p className="text-muted">Room: {roomId}</p>
                    <form onSubmit={handleJoinRoom} className="join-form">
                        <input
                            type="text"
                            className="input"
                            placeholder="Enter your nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            maxLength={20}
                            autoFocus
                        />
                        <div className="buyin-input-group">
                            <label htmlFor="buyin">Buy-in Amount:</label>
                            <input
                                id="buyin"
                                type="number"
                                className="input"
                                placeholder="Buy-in amount"
                                value={buyinAmount}
                                onChange={(e) => setBuyinAmount(e.target.value)}
                                min={1}
                                step={1}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={!nickname.trim()}
                        >
                            Join Table
                        </button>
                    </form>
                    <button
                        className="btn btn-ghost"
                        onClick={() => navigate('/')}
                    >
                        Back to Lobby
                    </button>
                </div>
            </div>
        )
    }

    if (!roomState) {
        return (
            <div className="poker-room">
                <div className="loading">Loading room...</div>
            </div>
        )
    }

    return (
        <div className="poker-room">
            {error && (
                <div className="error-toast">
                    {error}
                </div>
            )}

            <div className="room-header">
                <div className="room-info">
                    <h3>Room: {roomId}</h3>
                    <div className="room-stats">
                        <span>Players: {roomState.players.length}</span>
                        {roomState.handCount > 0 && (
                            <span>Hand: {roomState.handCount}{roomState.settings.handLimit ? ` / ${roomState.settings.handLimit}` : ''}</span>
                        )}
                    </div>
                </div>

                <div className="room-controls">
                    {myPlayer && myPlayer.seatNumber !== null && (
                        <button
                            className={myPlayer.standUpNextHand ? "btn btn-secondary btn-sm" : "btn btn-outline-danger btn-sm"}
                            onClick={handleStandUp}
                            disabled={myPlayer.standUpNextHand && !roomState.gameState}
                        >
                            {myPlayer.standUpNextHand ? "Leave Next Hand" : "Leave Seat"}
                        </button>
                    )}
                    {myPlayer && (
                        <BuyInRequest
                            socket={socket}
                            isHost={isHost}
                            myPlayer={myPlayer}
                            roomState={roomState}
                        />
                    )}
                    {roomState && (
                        <ScoreBoard 
                            players={roomState.scoreboard || roomState.players} 
                        />
                    )}
                    {isHost && (
                        <HostControls
                            roomState={roomState}
                            socket={socket}
                        />
                    )}
                </div>
            </div>

            <BuyInNotification socket={socket} isHost={isHost} />
            
            <div className="room-content">
                {/* Desktop Chat Sidebar */}
                <div className="sidebar chat-sidebar desktop-chat-sidebar">
                    <Chat 
                        socket={socket} 
                        roomId={roomId}
                        initialMessages={chatMessages}
                        onMessagesChange={setChatMessages}
                    />
                </div>

                {/* Mobile Chat Modal */}
                {showChat && (
                    <div 
                        className="chat-modal-overlay"
                        onClick={() => setShowChat(false)}
                    >
                        <div 
                            className="chat-modal-content"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Chat 
                                socket={socket} 
                                roomId={roomId} 
                                onClose={() => setShowChat(false)}
                                initialMessages={chatMessages}
                                onMessagesChange={setChatMessages}
                            />
                        </div>
                    </div>
                )}

                <div className="table-container">
                    <PokerTable
                        visibleCommunityCards={visibleCommunityCards.length > 0 ? visibleCommunityCards : undefined}
                        roomState={roomState}
                        myPlayer={myPlayer}
                        holeCards={holeCards}
                        showdownHands={showdownHands}
                        handWinners={handWinners}
                        timerState={timerState}
                        onSitDown={handleSitDown}
                        onStandUp={handleStandUp}
                        onPlayerAction={handlePlayerAction}
                        onThrowItem={handleThrowItem}
                        onKickPlayer={handleKickPlayer}
                        impactMarks={impactMarks}
                        onTriggerRabbitHunt={handleTriggerRabbitHunt}
                        activeChatBubbles={activeChatBubbles}
                        onRemoveChatBubble={(bubbleId) => {
                            setActiveChatBubbles(prev => prev.filter(b => b.id !== bubbleId))
                        }}
                    />
                </div>

                <div className="action-sidebar desktop-action-sidebar">
                    {myPlayer && myPlayer.seatNumber !== null && roomState.gameState && 
                     roomState.gameState.bettingRound && // Only show if betting round is active
                     myPlayer.status !== 'all-in' && // Don't show if player is all-in
                     roomState.gameState.currentPlayer && ( // Only show if there's a current player (someone can act)
                        <ActionPanel
                            isMyTurn={roomState.gameState.currentPlayer === myPlayer.socketId}
                            currentBet={roomState.gameState.currentBet}
                            myBet={myPlayer.currentBet}
                            myChips={myPlayer.chips}
                            minRaise={roomState.gameState.minRaise}
                            pot={roomState.gameState.pot}
                            currentStreet={roomState.gameState.currentStreet}
                            onAction={handlePlayerAction}
                            timerState={timerState && timerState.playerId === myPlayer.socketId ? timerState : null}
                        />
                    )}
                </div>

                {/* Mobile Action Panel - Fixed at bottom */}
                {myPlayer && myPlayer.seatNumber !== null && roomState.gameState && 
                 roomState.gameState.bettingRound && // Only show if betting round is active
                 myPlayer.status !== 'all-in' && // Don't show if player is all-in
                 roomState.gameState.currentPlayer && ( // Only show if there's a current player (someone can act)
                    <div className="mobile-action-panel">
                        <ActionPanel
                            isMyTurn={roomState.gameState.currentPlayer === myPlayer.socketId}
                            currentBet={roomState.gameState.currentBet}
                            myBet={myPlayer.currentBet}
                            myChips={myPlayer.chips}
                            minRaise={roomState.gameState.minRaise}
                            pot={roomState.gameState.pot}
                            currentStreet={roomState.gameState.currentStreet}
                            onAction={handlePlayerAction}
                            timerState={timerState && timerState.playerId === myPlayer.socketId ? timerState : null}
                        />
                    </div>
                )}

                {/* Mobile Chat Button */}
                <button
                    className="mobile-chat-btn"
                    onClick={() => setShowChat(!showChat)}
                    aria-label="Toggle chat"
                >
                    💬
                    {showChat && <span className="chat-badge">●</span>}
                </button>
            </div>

            {/* Coin Animation for Pot Collection - only when hand is complete */}
            {!roomState?.gameState?.bettingRound && handWinners && handWinners.length > 0 && (
                <CoinAnimation 
                    winners={handWinners} 
                    isActive={true} 
                />
            )}

            {/* Item Animations */}
            {activeAnimations.map(animation => {
                // Use a component to handle position calculation after render
                return (
                    <ItemAnimationWrapper
                        key={animation.id}
                        animation={animation}
                        roomState={roomState}
                        onComplete={() => {
                            setActiveAnimations(prev => prev.filter(a => a.id !== animation.id))

                            const markId = `${animation.id}-mark`
                            // Show impact mark (allow multiple marks per player)
                            setImpactMarks(prev => {
                                const next = { ...prev }
                                const pushMark = (key) => {
                                    const arr = next[key] ? [...next[key]] : []
                                    arr.push({ id: markId, item: animation.item.id, timestamp: Date.now() })
                                    next[key] = arr
                                }
                                pushMark(animation.targetPlayerId)
                                if (animation.targetSocketId) pushMark(animation.targetSocketId)
                                return next
                            })

                            // Remove this specific impact mark after 4 seconds
                            setTimeout(() => {
                                setImpactMarks(prev => {
                                    const next = { ...prev }
                                    const removeMark = (key) => {
                                        if (!next[key]) return
                                        const filtered = next[key].filter(m => m.id !== markId)
                                        if (filtered.length === 0) {
                                            delete next[key]
                                        } else {
                                            next[key] = filtered
                                        }
                                    }
                                    removeMark(animation.targetPlayerId)
                                    if (animation.targetSocketId) removeMark(animation.targetSocketId)
                                    return next
                                })
                            }, 4000)
                        }}
                    />
                )
            })}
        </div>
    )
}

// Wrapper component to calculate positions after DOM is ready
function ItemAnimationWrapper({ animation, onComplete }) {
    const [positions, setPositions] = useState({
        from: animation.fromPosition || null,
        to: animation.toPosition || null
    })

    useEffect(() => {
        // If positions were not captured at emit time, try once after mount
        if (positions.from && positions.to) return

        const calculatePositions = () => {
            const fromElement = document.querySelector(`[data-player-id="${animation.fromPlayerId}"], [data-socket-id="${animation.fromSocketId}"]`)
            const toElement = document.querySelector(`[data-player-id="${animation.targetPlayerId}"], [data-socket-id="${animation.targetSocketId}"]`)

            if (fromElement && toElement) {
                const fromRect = fromElement.getBoundingClientRect()
                const toRect = toElement.getBoundingClientRect()
                
                setPositions({
                    from: {
                        x: fromRect.left + fromRect.width / 2,
                        y: fromRect.top + fromRect.height / 2
                    },
                    to: {
                        x: toRect.left + toRect.width / 2,
                        y: toRect.top + toRect.height / 2
                    }
                })
            }
        }

        calculatePositions()
        const timeout = setTimeout(calculatePositions, 100)
        return () => clearTimeout(timeout)
    }, [animation, positions.from, positions.to])

    if (!positions.from || !positions.to) return null

    return (
        <ItemAnimation
            item={animation.item}
            fromPosition={positions.from}
            toPosition={positions.to}
            onComplete={onComplete}
        />
    )
}
