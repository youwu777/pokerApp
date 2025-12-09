import { useState, useEffect, useRef } from 'react'
import './Chat.css'

export default function Chat({ socket, roomId, onClose, initialMessages = [], onMessagesChange }) {
    const [messages, setMessages] = useState(initialMessages)
    const [input, setInput] = useState('')
    const messagesEndRef = useRef(null)
    const messagesContainerRef = useRef(null)

    const emotes = ['GG', 'NH', 'WP', 'TY', '😂', '😎', '🔥', '💪']

    // Update messages when initialMessages prop changes (from parent)
    useEffect(() => {
        setMessages(initialMessages)
    }, [initialMessages])

    useEffect(() => {
        if (!socket) return

        const handleChatMessage = (message) => {
            setMessages(prev => {
                const newMessages = [...prev, message]
                // Notify parent component of message changes
                if (onMessagesChange) {
                    onMessagesChange(newMessages)
                }
                return newMessages
            })
        }

        socket.on('chat-message', handleChatMessage)

        return () => {
            socket.off('chat-message', handleChatMessage)
        }
    }, [socket, onMessagesChange])

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
                const container = messagesContainerRef.current
                // Use scrollTop instead of scrollIntoView for better mobile compatibility
                container.scrollTop = container.scrollHeight
            }
        })
    }, [messages])

    const sendMessage = (text) => {
        if (text.trim() && socket) {
            socket.emit('chat-message', { message: text.trim() })
            setInput('')
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        sendMessage(input)
    }

    const handleEmote = (emote) => {
        sendMessage(emote)
    }

    return (
        <div className="chat">
            <div className="chat-header">
                <h4>Chat</h4>
                {onClose && (
                    <button
                        className="chat-close-btn"
                        onClick={onClose}
                        aria-label="Close chat"
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="chat-messages" ref={messagesContainerRef}>
                {messages.length === 0 ? (
                    <div className="chat-empty">
                        No messages yet. Say hi! 👋
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div key={i} className="chat-message">
                            <span className="message-author">{msg.nickname}:</span>
                            <span className="message-text">{msg.message}</span>
                        </div>
                    ))
                )}
            </div>

            <div className="chat-emotes">
                {emotes.map(emote => (
                    <button
                        key={emote}
                        className="emote-btn"
                        onClick={() => handleEmote(emote)}
                    >
                        {emote}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    className="input chat-input"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={200}
                />
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!input.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    )
}
