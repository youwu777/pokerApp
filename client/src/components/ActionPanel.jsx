import { useState, useEffect } from 'react'
import './ActionPanel.css'

export default function ActionPanel({
    isMyTurn,
    currentBet,
    myBet,
    myChips,
    minRaise,
    pot,
    onAction,
    timerState
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

    // Timer logic - Combined action timer + timebank into one continuous bar
    const showTimer = isMyTurn && timerState && timerState.remaining !== undefined

    // Calculate separate percentages for action timer and timebank
    let actionPercent = 0
    let timebankPercent = 0
    let isLowTime = false
    let isTimeBank = false
    let timerCountdown = 0

    if (showTimer) {
        const actionTime = 30 // Action timer duration

        // During timebank phase, timebankRemaining might equal remaining
        let timebankTotal
        let totalTime

        if (timerState.usingTimeBank) {
            // In timebank: use remaining as the max timebank (first tick of timebank phase)
            timebankTotal = timerState.timebankRemaining ?? 60
            totalTime = actionTime + timebankTotal

            // Action time is done, show only timebank remaining
            actionPercent = 0
            timebankPercent = (timerState.remaining / totalTime) * 100
            isTimeBank = true
        } else {
            // In action phase: timebank hasn't been touched yet
            timebankTotal = timerState.timebankRemaining ?? 60
            totalTime = actionTime + timebankTotal

            // Show action time counting down + full timebank
            actionPercent = (timerState.remaining / totalTime) * 100
            timebankPercent = (timebankTotal / totalTime) * 100
            isTimeBank = false
        }

        isLowTime = timerState.remaining <= 5
        timerCountdown = Math.ceil(timerState.remaining)
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
            {/* Timer Bar */}
            {showTimer && (
                <div className="action-timer-container">
                    {/* Timebank bar (amber) - on the left */}
                    <div
                        className={`action-timer-bar timebank-timer ${isLowTime && isTimeBank ? 'low-time' : ''}`}
                        style={{ width: `${Math.min(timebankPercent, 100)}%` }}
                    />
                    {/* Action timer bar (blue) - positioned after timebank */}
                    <div
                        className={`action-timer-bar action-timer ${isLowTime && !isTimeBank ? 'low-time' : ''}`}
                        style={{
                            width: `${Math.min(actionPercent, 100)}%`,
                            left: `${Math.min(timebankPercent, 100)}%`
                        }}
                    />
                    <div className={`action-timer-countdown ${isTimeBank ? 'time-bank' : ''}`}>
                        {timerCountdown}s
                    </div>
                </div>
            )}

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
