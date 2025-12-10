import { useEffect, useState } from 'react'
import './ChatBubble.css'

export default function ChatBubble({ message, playerId, seatNumber, onRemove, updatedAt }) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Trigger fade-in animation
        requestAnimationFrame(() => {
            setIsVisible(true)
        })

        // Auto-remove after 5 seconds
        // Use updatedAt as dependency to reset timer when message updates
        const timeout = setTimeout(() => {
            setIsVisible(false)
            // Wait for fade-out animation to complete before removing
            setTimeout(() => {
                if (onRemove) onRemove()
            }, 300)
        }, 5000)

        return () => clearTimeout(timeout)
    }, [onRemove, updatedAt]) // Reset timer when updatedAt changes

    if (!message || !seatNumber) return null

    return (
        <div 
            className={`chat-bubble ${isVisible ? 'visible' : ''}`}
            data-seat={seatNumber}
        >
            <div className="chat-bubble-content">
                <div className="chat-bubble-author">{message.nickname}</div>
                <div className="chat-bubble-text">{message.message}</div>
            </div>
            <div className="chat-bubble-tail"></div>
        </div>
    )
}

