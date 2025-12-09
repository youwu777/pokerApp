import { useEffect, useState } from 'react'
import './ItemAnimation.css'

const ITEM_EMOJIS = {
    tomato: '🍅',
    egg: '🥚',
    flipflops: '🩴',
    boom: '💥'
}

export default function ItemAnimation({ 
    item, 
    fromPosition, 
    toPosition, 
    onComplete 
}) {
    const [position, setPosition] = useState(fromPosition)
    const [rotation, setRotation] = useState(0)

    useEffect(() => {
        if (!fromPosition || !toPosition) return

        const startTime = Date.now()
        const duration = 2000 // 2 seconds
        const startX = fromPosition.x
        const startY = fromPosition.y
        const deltaX = toPosition.x - startX
        const deltaY = toPosition.y - startY

        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Linear interpolation for position
            const currentX = startX + deltaX * progress
            const currentY = startY + deltaY * progress

            // Rotation (spinning) - 2 full rotations over the duration
            const currentRotation = 360 * progress * 2

            setPosition({ x: currentX, y: currentY })
            setRotation(currentRotation)

            if (progress < 1) {
                requestAnimationFrame(animate)
            } else {
                // Animation complete
                if (onComplete) {
                    onComplete()
                }
            }
        }

        requestAnimationFrame(animate)
    }, [fromPosition, toPosition, onComplete])

    if (!position) return null

    return (
        <div
            className="item-animation"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`
            }}
        >
            <span className="item-emoji">{ITEM_EMOJIS[item.id] || '🎯'}</span>
        </div>
    )
}

