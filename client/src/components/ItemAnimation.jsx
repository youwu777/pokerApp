import { useEffect, useRef, useState } from 'react'
import './ItemAnimation.css'

const ITEM_EMOJIS = {
    tomato: '🍅',
    egg: '🥚',
    flipflops: '🩴',
    boom: '💣'
}

export default function ItemAnimation({ 
    item, 
    fromPosition, 
    toPosition, 
    onComplete 
}) {
    const [position, setPosition] = useState(fromPosition)
    const [rotation, setRotation] = useState(0)
    const rafRef = useRef(null)
    const onCompleteRef = useRef(onComplete)

    useEffect(() => {
        onCompleteRef.current = onComplete
    }, [onComplete])

    useEffect(() => {
        if (!fromPosition || !toPosition) return

        const startTime = performance.now()
        const duration = 2000 // 2 seconds
        const startX = fromPosition.x
        const startY = fromPosition.y
        const deltaX = toPosition.x - startX
        const deltaY = toPosition.y - startY

        const easeOutQuad = (t) => 1 - (1 - t) * (1 - t)

        const animate = (now) => {
            const elapsed = now - startTime
            const linearProgress = Math.min(elapsed / duration, 1)
            const progress = easeOutQuad(linearProgress)

            const currentX = startX + deltaX * progress
            const currentY = startY + deltaY * progress
            const currentRotation = 360 * progress * 2

            setPosition({ x: currentX, y: currentY })
            setRotation(currentRotation)

            if (linearProgress < 1) {
                rafRef.current = requestAnimationFrame(animate)
            } else if (onCompleteRef.current) {
                onCompleteRef.current()
            }
        }

        rafRef.current = requestAnimationFrame(animate)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [fromPosition, toPosition])

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

