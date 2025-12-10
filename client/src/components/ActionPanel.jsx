import { useState, useEffect } from 'react'
import './ActionPanel.css'

export default function ActionPanel({
    isMyTurn,
    currentBet,
    myBet,
    myChips,
    minRaise,
    pot,
    onAction
}) {
    const [raiseAmount, setRaiseAmount] = useState(minRaise)

    // Update raiseAmount when minRaise changes
    useEffect(() => {
        setRaiseAmount(minRaise)
    }, [minRaise])

    // Calculate amount to call, but cap it at available chips
    // If player has fewer chips than the amount to call, they can only call what they have
    const rawAmountToCall = Math.max(0, currentBet - myBet) // Never negative
    const amountToCall = Math.min(rawAmountToCall, myChips) // Cap at available chips
    const canCheck = amountToCall === 0
    const canBet = currentBet === 0
    const canRaise = currentBet > 0 && myChips > amountToCall

    // Calculate total raise amount for display (myBet + amountToCall + raiseAmount)
    // This represents the player's total bet after raising
    const totalRaiseAmount = amountToCall + raiseAmount + myBet

    const setRaiseFromTotal = (total) => {
        const desired = Number(total) - amountToCall - myBet
        if (Number.isNaN(desired)) return
        const clamped = Math.max(minRaise, Math.min(desired, myChips))
        setRaiseAmount(clamped)
    }

    const handleFold = () => onAction('fold')
    const handleCheck = () => onAction('check')
    const handleCall = () => onAction('call')
    const handleBet = () => onAction('bet', raiseAmount)
    const handleRaise = () => onAction('raise', raiseAmount)
    const handleAllIn = () => onAction('all-in')

    const setPresetAmount = (multiplier) => {
        // Calculate the pot after calling (pot + amount to call + my raise)
        // This gives players a true sense of pot odds
        const potAfterCall = pot + amountToCall + myBet
        const calculatedAmount = Math.floor(potAfterCall * multiplier)
        // Ensure the amount is at least minRaise and not more than myChips
        const validAmount = Math.max(minRaise, Math.min(calculatedAmount, myChips))
        setRaiseAmount(validAmount)
    }

    if (!isMyTurn) {
        return (
            <div className="action-panel disabled">
                <div className="waiting-message">
                    Waiting for your turn...
                </div>
            </div>
        )
    }

    return (
        <div className="action-panel">
            <div className="action-buttons">
                <button
                    className={`btn btn-danger ${canCheck ? 'btn-dimmed' : ''}`}
                    onClick={handleFold}
                >
                    Fold
                </button>

                {canCheck ? (
                    <button
                        className="btn btn-success"
                        onClick={handleCheck}
                    >
                        Check
                    </button>
                ) : (
                    <button
                        className="btn btn-success"
                        onClick={handleCall}
                    >
                        Call ${amountToCall}
                    </button>
                )}

                {canBet && (
                    <button
                        className="btn btn-primary"
                        onClick={handleBet}
                    >
                        Bet ${raiseAmount}
                    </button>
                )}

                {canRaise && (
                    <button
                        className="btn btn-primary"
                        onClick={handleRaise}
                    >
                        Raise ${totalRaiseAmount}
                    </button>
                )}

                <button
                    className="btn btn-secondary"
                    onClick={handleAllIn}
                >
                    All In ${myChips}
                </button>
            </div>

            {(canBet || canRaise) && (
                <div className="raise-controls">
                    <div className="raise-slider">
                        <input
                            type="range"
                            min={minRaise}
                            max={myChips}
                            value={totalRaiseAmount}
                            onChange={(e) => setRaiseFromTotal(Number(e.target.value))}
                            className="range range-primary range-sm"
                        />
                        <div className="raise-amount-input">
                            <span className="currency-symbol">$</span>
                            <input
                                type="number"
                                min={minRaise}
                                max={myChips}
                                value={totalRaiseAmount}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (!Number.isNaN(val)) {
                                        setRaiseFromTotal(val);
                                    }
                                }}
                                className="input input-bordered input-sm w-24 text-center"
                            />
                        </div>
                    </div>

                    <div className="preset-buttons">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPresetAmount(0.25)}
                        >
                            1/4 Pot
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPresetAmount(0.5)}
                        >
                            1/2 Pot
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPresetAmount(0.75)}
                        >
                            3/4 Pot
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPresetAmount(1)}
                        >
                            1x Pot
                        </button>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPresetAmount(2)}
                        >
                            2x Pot
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
