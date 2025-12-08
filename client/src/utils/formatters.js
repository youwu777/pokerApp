export function formatChips(amount) {
    if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toString()
}

export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getCardDisplay(card) {
    if (!card) return ''

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

    return `${rankNames[rank] || rank}${suitSymbols[suit]}`
}
