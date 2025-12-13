import { useEffect, useState, useRef } from 'react'
import './ChatBubble.css'

export default function ChatBubble({ message, playerId, seatNumber, onRemove, updatedAt }) {
    const [isVisible, setIsVisible] = useState(false)
    const onRemoveRef = useRef(onRemove)
    const timeoutRef = useRef(null)
    const removeTimeoutRef = useRef(null)

    // Keep onRemove ref updated
    useEffect(() => {
        onRemoveRef.current = onRemove
    }, [onRemove])

    useEffect(() => {
        // Clear any existing timeouts
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        if (removeTimeoutRef.current) {
            clearTimeout(removeTimeoutRef.current)
        }

        // Trigger fade-in animation
        requestAnimationFrame(() => {
            setIsVisible(true)
        })

        // Auto-remove after 5 seconds
        // Use updatedAt as dependency to reset timer when message updates
        timeoutRef.current = setTimeout(() => {
            setIsVisible(false)
            // Wait for fade-out animation to complete before removing
            removeTimeoutRef.current = setTimeout(() => {
                if (onRemoveRef.current) {
                    onRemoveRef.current()
                }
            }, 300)
        }, 5000)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            if (removeTimeoutRef.current) {
                clearTimeout(removeTimeoutRef.current)
            }
        }
    }, [updatedAt]) // Only reset timer when updatedAt changes

    if (!message || seatNumber == null) return null

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
