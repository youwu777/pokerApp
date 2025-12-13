import { useState, useEffect } from 'react'
import './BuyInNotification.css'

export default function BuyInNotification({ socket, isHost }) {
    const [notifications, setNotifications] = useState([])

    useEffect(() => {
        if (!socket || !isHost) return

        const handleBuyInRequest = (data) => {
            setNotifications(prev => [...prev, data])
        }

        socket.on('buyin-request-notification', handleBuyInRequest)

        return () => {
            socket.off('buyin-request-notification', handleBuyInRequest)
        }
    }, [socket, isHost])

    const handleApprove = (requestId) => {
        if (socket) {
            socket.emit('buyin-approve', { requestId })
            setNotifications(prev => prev.filter(n => n.requestId !== requestId))
        }
    }

    const handleReject = (requestId) => {
        if (socket) {
            socket.emit('buyin-reject', { requestId })
            setNotifications(prev => prev.filter(n => n.requestId !== requestId))
        }
    }

    if (!isHost || notifications.length === 0) {
        return null
    }

    return (
        <div className="buyin-notifications-container">
            {notifications.map(notification => (
                <div key={notification.requestId} className="buyin-notification">
                    <div className="notification-header">
                        <h3>
                            {notification.isInitialJoin ? 'New Player Request' : 'Buy-In Request'}
                        </h3>
                        {notification.isInitialJoin && (
                            <span className="new-player-badge">NEW</span>
                        )}
                    </div>
                    <div className="notification-body">
                        <div className="notification-player">
                            <strong>{notification.nickname}</strong>
                        </div>
                        <div className="notification-amount">
                            ${notification.amount}
                        </div>
                    </div>
                    <div className="notification-actions">
                        <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(notification.requestId)}
                        >
                            Approve
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleReject(notification.requestId)}
                        >
                            Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}

