import { useState, useEffect, useRef } from 'react'
import './ThrowItemMenu.css'

const ITEMS = [
    { id: 'tomato', name: 'Tomato', emoji: '🍅' },
    { id: 'egg', name: 'Egg', emoji: '🥚' },
    { id: 'flipflops', name: 'Flip Flops', emoji: '🩴' },
    { id: 'boom', name: 'Boom', emoji: '💥' }
]

export default function ThrowItemMenu({ 
    targetPlayer, 
    myPlayer, 
    onItemSelect, 
    onClose,
    position 
}) {
    const menuRef = useRef(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onClose])

    // Prevent throwing at yourself
    if (!targetPlayer || !myPlayer || targetPlayer.socketId === myPlayer.socketId) {
        return null
    }

    const handleItemClick = (item) => {
        console.log('[THROW] menu click', { item, targetPlayerId: targetPlayer?.playerId, targetSocketId: targetPlayer?.socketId })
        onItemSelect(item, targetPlayer)
        onClose()
    }

    const menuStyle = position ? {
        left: `${position.x}px`,
        top: `${position.y}px`
    } : {}

    if (!position) {
        console.warn('ThrowItemMenu: No position provided')
        return null
    }

    return (
        <div 
            ref={menuRef}
            className="throw-item-menu"
            style={menuStyle}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="throw-item-menu-header">
                <span>Throw at {targetPlayer.nickname}</span>
            </div>
            <div className="throw-item-list">
                {ITEMS.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        className="throw-item-btn"
                        onClick={() => handleItemClick(item)}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <span className="throw-item-emoji">{item.emoji}</span>
                        <span className="throw-item-name">{item.name}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

