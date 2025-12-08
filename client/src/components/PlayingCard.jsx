import './PlayingCard.css'

export default function PlayingCard({ card, faceDown = false }) {
    if (!card || faceDown) {
        return (
            <div className="playing-card card-back">
                <div className="card-pattern"></div>
            </div>
        )
    }

    // Parse card: e.g., "Ah" = Ace of hearts
    const rank = card[0]
    const suit = card[1]

    const suitSymbols = {
        'h': '♥',
        'd': '♦',
        'c': '♣',
        's': '♠'
    }

    const rankNames = {
        'T': '10',
        'J': 'J',
        'Q': 'Q',
        'K': 'K',
        'A': 'A'
    }

    const displayRank = rankNames[rank] || rank
    const suitSymbol = suitSymbols[suit]
    const isRed = suit === 'h' || suit === 'd'

    return (
        <div className={`playing-card ${isRed ? 'red' : 'black'}`}>
            <div className="card-corner top-left">
                <div className="card-rank">{displayRank}</div>
                <div className="card-suit">{suitSymbol}</div>
            </div>
            <div className="card-center">
                <div className="card-suit-large">{suitSymbol}</div>
            </div>
            <div className="card-corner bottom-right">
                <div className="card-rank">{displayRank}</div>
                <div className="card-suit">{suitSymbol}</div>
            </div>
        </div>
    )
}
