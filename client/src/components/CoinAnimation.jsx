import { useEffect, useState } from 'react'
import './CoinAnimation.css'

export default function CoinAnimation({ winners, isActive }) {
    const [coins, setCoins] = useState([])

    useEffect(() => {
        console.log('[COIN-ANIMATION] Effect triggered - isActive:', isActive, 'winners:', winners)

        if (!isActive || !winners || winners.length === 0) {
            setCoins([])
            return
        }

        // Calculate positions for each winner's seat
        const tableCenter = document.querySelector('.table-center')
        const tableCenterRect = tableCenter?.getBoundingClientRect()

        if (!tableCenterRect) {
            console.error('[COIN-ANIMATION] Could not find table center')
            return
        }

        const centerX = tableCenterRect.left + tableCenterRect.width / 2
        const centerY = tableCenterRect.top + tableCenterRect.height / 2

        // Create coins for animation
        const newCoins = []
        const coinsPerWinner = 15 // Number of coins to animate per winner

        winners.forEach((winner, winnerIndex) => {
            console.log('[COIN-ANIMATION] Creating coins for winner:', winner.nickname, 'seat:', winner.seatNumber)

            // Get the seat element position
            const seatElement = document.querySelector(`.seat-${winner.seatNumber} .player-seat`)
            const seatRect = seatElement?.getBoundingClientRect()

            if (!seatRect) {
                console.error('[COIN-ANIMATION] Could not find seat element for seat', winner.seatNumber)
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

        console.log('[COIN-ANIMATION] Created coins:', newCoins.length)
        setCoins(newCoins)

        // Clear coins after animation completes
        const timeout = setTimeout(() => {
            setCoins([])
        }, 2000)

        return () => clearTimeout(timeout)
    }, [isActive, winners])

    if (coins.length === 0) {
        console.log('[COIN-ANIMATION] Not rendering - no coins')
        return null
    }

    console.log('[COIN-ANIMATION] Rendering', coins.length, 'coins')

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
