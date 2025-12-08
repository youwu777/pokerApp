import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import PokerTable from './PokerTable'
import ActionPanel from './ActionPanel'
import Chat from './Chat'
import HostControls from './HostControls'
import './PokerRoom.css'

export default function PokerRoom() {
    const { roomId } = useParams()
    const navigate = useNavigate()
    const { socket } = useSocket()

    const [nickname, setNickname] = useState('')
    const [buyinAmount, setBuyinAmount] = useState(1000)
    const [joined, setJoined] = useState(false)
    const [roomState, setRoomState] = useState(null)
    const [myPlayer, setMyPlayer] = useState(null)
    const [isHost, setIsHost] = useState(false)
    const [holeCards, setHoleCards] = useState([])
    const [showdownHands, setShowdownHands] = useState([])
    const [timerState, setTimerState] = useState(null)
    const [error, setError] = useState(null)
    const [roomNotFound, setRoomNotFound] = useState(false)

    useEffect(() => {
        if (!socket) return

        // Socket event listeners
        socket.on('room-joined', (data) => {
            setJoined(true)
            setIsHost(data.isHost)
            setRoomState(data.roomState)
        })

        socket.on('room-state', (state) => {
            setRoomState(state)
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
        })

        socket.on('new-hand', ({ gameState, roomState }) => {
            setRoomState(roomState)
            setShowdownHands([]) // Clear showdown hands
            // Cards will be set by deal-cards event
        })

        socket.on('player-acted', ({ playerId, action, gameState, roomState }) => {
            setRoomState(roomState)
            // Clear timer state when player acts (will be updated by next timer-tick or cleared)
            setTimerState(null)
        })

        socket.on('timer-tick', (data) => {
            setTimerState(data)
        })

        socket.on('player-timeout', ({ playerId }) => {
            console.log(`Player ${playerId} timed out`)
            setTimerState(null)
        })

        socket.on('hand-complete', ({ results, roomState }) => {
            setRoomState(roomState)
            setHoleCards([]) // Clear cards after hand ends
            setTimerState(null) // Clear timer
            if (results.revealedHands) {
                setShowdownHands(results.revealedHands)
            }
            console.log('Hand complete:', results)
        })

        socket.on('chat-message', (message) => {
            // Handled by Chat component
        })

        socket.on('error', ({ message }) => {
            if (message === 'Room not found') {
                setRoomNotFound(true)
            } else {
                setError(message)
                setTimeout(() => setError(null), 5000)
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
            socket.off('error')
        }
    }, [socket])



    // Update myPlayer when roomState changes
    useEffect(() => {
        if (roomState && socket) {
            const player = roomState.players.find(p => p.socketId === socket.id)
            setMyPlayer(player)
        }
    }, [roomState, socket])

    const handleJoinRoom = (e) => {
        e.preventDefault()
        if (nickname.trim() && socket) {
            const buyin = parseInt(buyinAmount, 10) || 1000
            console.log('Joining room with buyin:', buyin)
            socket.emit('join-room', {
                roomId,
                nickname: nickname.trim(),
                buyinAmount: buyin
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
            socket.emit('player-action', { action, amount })
        }
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
                            style={{ marginRight: '10px' }}
                            disabled={myPlayer.standUpNextHand && !roomState.gameState}
                        >
                            {myPlayer.standUpNextHand ? "Leave Next Hand" : "Leave Seat"}
                        </button>
                    )}
                    {isHost && (
                        <HostControls
                            roomState={roomState}
                            socket={socket}
                        />
                    )}
                </div>
            </div>

            <div className="room-content">
                <div className="sidebar">
                    <Chat socket={socket} roomId={roomId} />
                </div>

                <div className="table-container">
                    <PokerTable
                        roomState={roomState}
                        myPlayer={myPlayer}
                        holeCards={holeCards}
                        showdownHands={showdownHands}
                        timerState={timerState}
                        onSitDown={handleSitDown}
                        onStandUp={handleStandUp}
                        onPlayerAction={handlePlayerAction}
                    />
                </div>

                <div className="action-sidebar">
                    {myPlayer && myPlayer.seatNumber !== null && roomState.gameState && (
                        <ActionPanel
                            isMyTurn={roomState.gameState.currentPlayer === myPlayer.socketId}
                            currentBet={roomState.gameState.currentBet}
                            myBet={myPlayer.currentBet}
                            myChips={myPlayer.chips}
                            minRaise={roomState.gameState.minRaise}
                            pot={roomState.gameState.pot}
                            onAction={handlePlayerAction}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
