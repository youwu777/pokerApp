import PlayingCard from './PlayingCard'
import './RabbitHuntCards.css'

export default function RabbitHuntCards({ rabbitHunt, onTriggerRabbitHunt }) {
    if (!rabbitHunt || rabbitHunt.cardCount === 0) {
        return null
    }

    // If rabbit hunt is revealed, show the actual cards (same as regular cards)
    if (rabbitHunt.revealed && rabbitHunt.cards) {
        return (
            <>
                {rabbitHunt.cards.map((card, i) => (
                    <PlayingCard key={`rabbit-${i}`} card={card} />
                ))}
            </>
        )
    }

    // If rabbit hunt is available, show face-down cards with rabbit emoji
    if (rabbitHunt.available) {
        const handleClick = (e) => {
            e.stopPropagation()
            if (onTriggerRabbitHunt) {
                onTriggerRabbitHunt()
            }
        }

        return Array(rabbitHunt.cardCount).fill(null).map((_, i) => (
            <div
                key={`rabbit-back-${i}`}
                className="rabbit-hunt-card"
                onClick={handleClick}
                title="Click to reveal undealt cards (Rabbit Hunt)"
            >
                <PlayingCard faceDown={true} />
                <span className="rabbit-emoji">🐰</span>
            </div>
        ))
    }

    return null
}
