import { useState, useEffect, useRef } from 'react'
import './Chat.css'

export default function Chat({ socket, roomId }) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const messagesEndRef = useRef(null)

    const emotes = ['GG', 'NH', 'WP', 'TY', '😂', '😎', '🔥', '💪']

    useEffect(() => {
        if (!socket) return

        socket.on('chat-message', (message) => {
            setMessages(prev => [...prev, message])
        })

        return () => {
            socket.off('chat-message')
        }
    }, [socket])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
            </div>

            <div className="chat-messages">
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
                <div ref={messagesEndRef} />
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
