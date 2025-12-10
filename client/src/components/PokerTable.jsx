import PlayerSeat from './PlayerSeat'
import PlayingCard from './PlayingCard'
import RabbitHuntCards from './RabbitHuntCards'
import ChatBubble from './ChatBubble'
import './PokerTable.css'

export default function PokerTable({
    roomState,
    myPlayer,
    holeCards,
    showdownHands,
    timerState,
    onSitDown,
    onStandUp,
    onPlayerAction,
    visibleCommunityCards,
    onThrowItem,
    onKickPlayer,
    impactMarks,
    onTriggerRabbitHunt,
    activeChatBubbles = [],
    onRemoveChatBubble
}) {
    const gameState = roomState?.gameState
    const players = roomState?.players || []
    const isHost = roomState?.hostSocketId === myPlayer?.socketId
    
    // Use visibleCommunityCards if provided (for progressive reveal), otherwise use gameState.communityCards
    const communityCards = visibleCommunityCards && visibleCommunityCards.length > 0 
        ? visibleCommunityCards.filter(card => card !== null)
        : (gameState?.communityCards || [])

    // Arrange players in seats (0-9)
    const seats = Array(10).fill(null).map((_, index) => {
        return players.find(p => p.seatNumber === index) || null
    })

    const isMyTurn = gameState && myPlayer &&
        gameState.currentPlayer === myPlayer.socketId

    const seatedPlayers = players.filter(p => p.seatNumber !== null).length
    const isViewerSeated = myPlayer && myPlayer.seatNumber !== null

    return (
        <div className="poker-table-wrapper">
            <div className="poker-table">
                {/* Community Cards & Pot */}
                <div className="table-center">
                    {gameState ? (
                        <>
                            <div className="community-cards">
                                {communityCards.map((card, i) => (
                                    <PlayingCard key={i} card={card} />
                                ))}
                                {/* Rabbit Hunt Cards - only show when hand is complete (bettingRound is null) */}
                                {!gameState.bettingRound && gameState.rabbitHunt && (
                                    <RabbitHuntCards
                                        rabbitHunt={gameState.rabbitHunt}
                                        onTriggerRabbitHunt={onTriggerRabbitHunt}
                                    />
                                )}
                            </div>
                            <div className="pot-display">
                                <div className="pot-amount mono">${gameState.pot}</div>
                            </div>
                        </>
                    ) : (
                        <div className="waiting-to-start">
                            <div className="waiting-icon">🃏</div>
                            <div className="waiting-text">
                                {seatedPlayers >= 2 ? (
                                    <>Waiting for host to start game...</>
                                ) : (
                                    <>Waiting for players to sit down...</>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Player Seats */}
                {seats.map((player, seatNumber) => {
                    // Calculate logical index for position determination
                    // Filter seated players and sort by seat number to match backend logic
                    const activePlayers = players
                        .filter(p => p.seatNumber !== null)
                        .sort((a, b) => a.seatNumber - b.seatNumber);

                    const playerIndex = player ? activePlayers.findIndex(p => p.seatNumber === seatNumber) : -1;

                    // Find showdown hand for this player
                    const showdownHand = player && showdownHands ? showdownHands.find(h => h.socketId === player.socketId) : null;

                    // Find chat bubble for this seat
                    const seatChatBubble = activeChatBubbles.find(bubble => 
                        bubble.seatNumber === seatNumber
                    )

                    return (
                        <div key={seatNumber} className={`seat seat-${seatNumber}`}>
                            <div className="seat-content-wrapper">
                                <PlayerSeat
                                    player={player}
                                    seatNumber={seatNumber}
                                    playerIndex={playerIndex}
                                    isMe={player?.socketId === myPlayer?.socketId}
                                    holeCards={player?.socketId === myPlayer?.socketId ? holeCards : []}
                                    showdownHand={showdownHand}
                                    timerState={timerState}
                                    dealerPosition={gameState?.dealerPosition}
                                    totalPlayers={seatedPlayers}
                                    onSitDown={() => onSitDown(seatNumber)}
                                    onStandUp={onStandUp}
                                    isCurrentPlayer={gameState?.currentPlayer === player?.socketId}
                                    isViewerSeated={isViewerSeated}
                                    myPlayer={myPlayer}
                                    onThrowItem={onThrowItem}
                                    onKickPlayer={onKickPlayer}
                                    isHost={isHost}
                                    impactMarks={impactMarks?.[player?.playerId] || impactMarks?.[player?.socketId] || []}
                                />
                                {seatChatBubble && (
                                    <ChatBubble
                                        key={seatChatBubble.id}
                                        message={seatChatBubble.message}
                                        playerId={seatChatBubble.playerId}
                                        seatNumber={seatNumber}
                                        updatedAt={seatChatBubble.updatedAt}
                                        onRemove={() => {
                                            if (onRemoveChatBubble) {
                                                onRemoveChatBubble(seatChatBubble.id)
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
