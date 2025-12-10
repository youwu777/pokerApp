import { useEffect, useState } from 'react'
import soundManager from '../utils/sounds'
import './CoinAnimation.css'

export default function CoinAnimation({ winners, isActive }) {
    const [coins, setCoins] = useState([])

    useEffect(() => {
        // Early return if not active - don't do any DOM queries
        if (!isActive || !winners || winners.length === 0) {
            setCoins([])
            return
        }

        // Play gold collect sound when animation starts
        soundManager.playGoldCollect()

        // Small delay to ensure DOM is ready
        const timeout = setTimeout(() => {
            // Calculate positions for each winner's seat
            const tableCenter = document.querySelector('.table-center')
            const tableCenterRect = tableCenter?.getBoundingClientRect()

            if (!tableCenterRect) {
                // Silently return if table center not found
                return
            }

            const centerX = tableCenterRect.left + tableCenterRect.width / 2
            const centerY = tableCenterRect.top + tableCenterRect.height / 2

            // Create coins for animation
            const newCoins = []
            const coinsPerWinner = 15 // Number of coins to animate per winner

            winners.forEach((winner, winnerIndex) => {
                // Get the seat element position
                const seatElement = document.querySelector(`.seat-${winner.seatNumber} .player-seat`)
                const seatRect = seatElement?.getBoundingClientRect()

                if (!seatRect) {
                    // Silently skip if seat not found
                    return
                }

                const targetX = seatRect.left + seatRect.width / 2
                const targetY = seatRect.top + seatRect.height / 2

                for (let i = 0; i < coinsPerWinner; i++) {
                    newCoins.push({
                        id: `${winnerIndex}-${i}`,
                        seatNumber: winner.seatNumber,
                        delay: i * 0.05, // Stagger the coins
                        startX: centerX,
                        startY: centerY,
                        targetX,
                        targetY
                    })
                }
            })

            setCoins(newCoins)

            // Clear coins after animation completes
            const clearTimeoutId = setTimeout(() => {
                setCoins([])
            }, 2000)

            return () => clearTimeout(clearTimeoutId)
        }, 50)

        return () => clearTimeout(timeout)
    }, [isActive, winners])

    if (coins.length === 0) {
        return null
    }

    return (
        <div className="coin-animation-container">
            {coins.map(coin => (
                <div
                    key={coin.id}
                    className="flying-coin"
                    style={{
                        '--start-x': `${coin.startX}px`,
                        '--start-y': `${coin.startY}px`,
                        '--target-x': `${coin.targetX}px`,
                        '--target-y': `${coin.targetY}px`,
                        animationDelay: `${coin.delay}s`
                    }}
                >
                    <span className="coin-spinner">🪙</span>
                </div>
            ))}
        </div>
    )
}
