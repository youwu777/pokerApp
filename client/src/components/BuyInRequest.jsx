import { useState, useEffect } from 'react'
import './BuyInRequest.css'

export default function BuyInRequest({ socket, isHost, myPlayer, roomState }) {
    const [showModal, setShowModal] = useState(false)
    const [amount, setAmount] = useState('')
    const [pendingRequest, setPendingRequest] = useState(null)
    const [error, setError] = useState(null)

    // Show for all players (including host)
    if (!myPlayer) {
        return null
    }

    // Check if player has a pending initial join request
    const hasPendingInitialJoin = roomState?.pendingBuyIns?.find(
        req => req.playerId === myPlayer.playerId && req.isInitialJoin
    )

    const handleRequest = (e) => {
        e.preventDefault()
        const buyinAmount = parseInt(amount, 10)
        
        if (isNaN(buyinAmount) || buyinAmount <= 0) {
            setError('Please enter a valid amount')
            return
        }

        if (socket) {
            socket.emit('buyin-request', { amount: buyinAmount })
            setPendingRequest({ amount: buyinAmount, status: 'pending' })
            setShowModal(false)
            setAmount('')
            setError(null)
        }
    }

    // Listen for buy-in responses
    useEffect(() => {
        if (!socket) return

        const handleRequestSent = (data) => {
            setPendingRequest(data)
        }

        const handleApproved = (data) => {
            setPendingRequest(null)
            // Show success message or notification
        }

        const handleRejected = (data) => {
            setPendingRequest(null)
            setError('Buy-in request was rejected')
            setTimeout(() => setError(null), 5000)
        }

        socket.on('buyin-request-sent', handleRequestSent)
        socket.on('buyin-approved', handleApproved)
        socket.on('buyin-rejected', handleRejected)

        return () => {
            socket.off('buyin-request-sent', handleRequestSent)
            socket.off('buyin-approved', handleApproved)
            socket.off('buyin-rejected', handleRejected)
        }
    }, [socket])

    // Show waiting message for initial join approval
    if (hasPendingInitialJoin && myPlayer.stack === 0) {
        return (
            <div className="waiting-approval-banner">
                <div className="waiting-icon">⏳</div>
                <div className="waiting-text">
                    <div className="waiting-title">Waiting for Host Approval</div>
                    <div className="waiting-subtitle">Requested ${hasPendingInitialJoin.amount} to join</div>
                </div>
            </div>
        )
    }

    return (
        <>
            <button
                className="buyin-request-btn"
                onClick={() => setShowModal(true)}
                disabled={pendingRequest !== null}
            >
                {pendingRequest ? `Buy-in Pending: $${pendingRequest.amount}` : 'Buy In'}
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content buyin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Request Buy-In</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleRequest} className="buyin-form">
                            <div className="form-group">
                                <label htmlFor="buyin-amount">Amount:</label>
                                <input
                                    id="buyin-amount"
                                    type="number"
                                    className="input"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min={1}
                                    step={1}
                                    autoFocus
                                    placeholder="Enter amount"
                                />
                            </div>
                            {error && <div className="error-message">{error}</div>}
                            <div className="modal-actions">
                                <button type="submit" className="btn btn-primary">
                                    Request
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

