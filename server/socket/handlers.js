import { roomManager } from '../utils/roomManager.js';
import { Player } from '../models/Player.js';
import { PokerGame } from '../engine/PokerGame.js';
import { RunItTwice } from '../engine/RunItTwice.js';
import { RabbitHunt } from '../engine/RabbitHunt.js';
import { PlayerTimer } from '../utils/Timer.js';

const activeTimers = new Map(); // roomId -> timer

export function setupSocketHandlers(io, socket) {

    // Join room
    socket.on('join-room', ({ roomId, nickname, buyinAmount }) => {
        const room = roomManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        try {
            const buyin = buyinAmount || 1000;
            console.log(`[JOIN] ${nickname} joining with buyin: ${buyin} (type: ${typeof buyin})`);
            const player = new Player(socket.id, nickname, buyin);
            console.log(`[JOIN] Player created with stack: ${player.stack}`);
            room.addPlayer(player);
            socket.join(roomId);

            // Send room state to new player
            socket.emit('room-joined', {
                roomId,
                isHost: room.isHost(socket.id),
                roomState: room.toJSON()
            });

            // Notify others
            io.to(roomId).emit('player-joined', {
                player: player.toJSON()
            });

            console.log(`${nickname} joined room ${roomId} with $${buyin}`);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Sit down at table
    socket.on('sit-down', ({ seatNumber }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (!player) return;

        // Check if seat is available
        const seatTaken = room.players.some(p => p.seatNumber === seatNumber);
        if (seatTaken) {
            socket.emit('error', { message: 'Seat already taken' });
            return;
        }

        console.log(`[SIT] ${player.nickname} sitting with stack: ${player.stack}`);
        player.sitDown(seatNumber, room.settings.timeBank);
        console.log(`[SIT] ${player.nickname} chips after sitting: ${player.chips}`);

        // Add player to scoreboard (scoreboard is at Room level)
        if (!room.scoreboard.has(player.socketId)) {
            room.scoreboard.set(player.socketId, {
                socketId: player.socketId,
                nickname: player.nickname,
                buyin: player.buyin,
                stack: player.stack,
                isActive: true
            });
        } else {
            // Update existing entry
            const stats = room.scoreboard.get(player.socketId);
            stats.isActive = true;
            stats.stack = player.stack;
        }

        // If game is in progress, set status to waiting
        if (room.game) {
            player.status = 'waiting-next-hand';
        }

        io.to(room.id).emit('room-state', room.toJSON());
    });

    // Stand up from table
    socket.on('stand-up', () => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (!player) return;

        // If game is in progress and player is involved, mark for stand up next hand
        if (room.game && (player.status === 'active' || player.status === 'all-in' || player.status === 'folded')) {
            player.standUpNextHand = !player.standUpNextHand;

            // Notify player of status change (via room state update)
            io.to(room.id).emit('room-state', room.toJSON());

            if (player.standUpNextHand) {
                socket.emit('notification', { message: 'You will stand up after this hand' });
            } else {
                socket.emit('notification', { message: 'Stand up cancelled' });
            }
            return;
        }

        player.standUp();
        
            // Update scoreboard with final stack (scoreboard is at Room level)
            if (room.scoreboard.has(player.socketId)) {
                const stats = room.scoreboard.get(player.socketId);
                stats.stack = player.stack;
            }

        io.to(room.id).emit('room-state', room.toJSON());
    });

    // Start game / new hand
    socket.on('start-hand', () => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        if (!room.isHost(socket.id)) {
            socket.emit('error', { message: 'Only host can start hands' });
            return;
        }

        if (room.isPaused) {
            room.isPaused = false;
        }

        try {
            // Check if there are enough seated players
            const seatedPlayers = room.getSeatedPlayers();
            if (seatedPlayers.length < 2) {
                socket.emit('error', { message: 'Need at least 2 seated players to start' });
                return;
            }

            // Create new game if needed
            if (!room.game) {
                room.game = new PokerGame(room);
            }

            const gameState = room.game.startNewHand();

            // Send hole cards privately to each player
            for (const player of room.game.players) {
                io.to(player.socketId).emit('deal-cards', {
                    holeCards: player.holeCards
                });
            }

            // Broadcast game state
            io.to(room.id).emit('new-hand', {
                gameState,
                roomState: room.toJSON()
            });

            // Start timer for first player
            startPlayerTimer(io, room);

        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // Player action
    socket.on('player-action', ({ action, amount }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.game) return;

        const player = room.getPlayer(socket.id);
        if (!player) return;

        // Stop current timer
        stopPlayerTimer(room.id);

        console.log(`[ACTION] ${player.nickname} ${action} ${amount || ''}`);
        const result = room.game.processAction(player, action, amount);

        if (!result.success) {
            console.log(`[ACTION] Failed: ${result.message}`);
            socket.emit('error', { message: result.message });
            // Restart timer
            startPlayerTimer(io, room);
            return;
        }
        
        console.log(`[ACTION] Success: ${result.action}, Round complete: ${room.game.bettingRound.isComplete()}`);

        // Broadcast action
        io.to(room.id).emit('player-acted', {
            playerId: socket.id,
            action: result.action,
            amount: player.currentBet,
            gameState: room.game.toJSON(),
            roomState: room.toJSON()
        });

        // Check if hand ended with showdown results
        if (result.showdownResults) {
            console.log('[DEBUG] Emitting hand-complete with results');

            // Send hand-complete with current game state (so frontend can show final chips)
            io.to(room.id).emit('hand-complete', {
                results: result.showdownResults,
                roomState: room.toJSON()
            });

            console.log('[DEBUG] Hand complete. Starting 5s timer for next hand.');

            // Auto-start next hand after 5 seconds
            setTimeout(() => {
                try {
                    // Check if room still exists
                    const currentRoom = roomManager.getRoom(room.id);
                    if (!currentRoom) {
                        console.log('[DEBUG] Cannot auto-start: Room no longer exists');
                        return;
                    }

                    // Process stand up requests before next hand
                    for (const player of currentRoom.players) {
                        if (player.standUpNextHand) {
                            console.log(`[DEBUG] ${player.nickname} standing up before next hand`);
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            if (currentRoom.scoreboard.has(player.socketId)) {
                                const stats = currentRoom.scoreboard.get(player.socketId);
                                stats.stack = player.stack;
                            }
                        }
                    }

                    // Update room state after stand-ups
                    io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());

                    // Check if there are enough seated players to start
                    const seatedPlayers = currentRoom.getSeatedPlayers();
                    if (seatedPlayers.length < 2) {
                        console.log('[DEBUG] Cannot auto-start: Insufficient seated players after stand-ups');
                        currentRoom.game = null;
                        io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());
                        return;
                    }

                    console.log('[DEBUG] Auto-starting next hand...');
                    const newGameState = currentRoom.game.startNewHand();

                    // Send hole cards privately to each player
                    for (const player of currentRoom.game.players) {
                        io.to(player.socketId).emit('deal-cards', {
                            holeCards: player.holeCards
                        });
                    }

                    // Broadcast game state
                    io.to(currentRoom.id).emit('new-hand', {
                        gameState: newGameState,
                        roomState: currentRoom.toJSON()
                    });

                    // Start timer for first player
                    startPlayerTimer(io, currentRoom);

                } catch (error) {
                    console.error('[ERROR] Auto-start failed:', error);
                    io.to(room.id).emit('error', { message: 'Failed to start next hand' });
                }
            }, 5000);

            return;
        }

        // Check for Run It Twice opportunity
        if (RunItTwice.isApplicable(room.game)) {
            const involvedPlayers = RunItTwice.getInvolvedPlayers(room.game);
            io.to(room.id).emit('rit-prompt', {
                players: involvedPlayers.map(p => p.socketId)
            });
            return; // Wait for RIT responses
        }

        // Start timer for next player if betting continues
        if (room.game.bettingRound && !room.game.bettingRound.isComplete()) {
            startPlayerTimer(io, room);
        }
    });

    // Run It Twice response
    socket.on('rit-response', ({ agree }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.game) return;

        // Store response (simplified - in production, track all responses)
        if (!room.ritResponses) {
            room.ritResponses = new Map();
        }
        room.ritResponses.set(socket.id, agree);

        const involvedPlayers = RunItTwice.getInvolvedPlayers(room.game);
        const allResponded = involvedPlayers.every(p => room.ritResponses.has(p.socketId));

        if (allResponded) {
            const allAgree = involvedPlayers.every(p => room.ritResponses.get(p.socketId));
            room.ritResponses.clear();

            if (allAgree) {
                // Execute Run It Twice
                const ritResults = RunItTwice.execute(room.game);
                // Update stack for all players after Run It Twice
                room.game.players.forEach(player => {
                    if (player.seatNumber !== null) {
                        player.stack = player.chips;
                        // Update scoreboard (scoreboard is at Room level)
                        if (room.scoreboard.has(player.socketId)) {
                            const stats = room.scoreboard.get(player.socketId);
                            stats.stack = player.stack;
                        }
                    }
                });
                io.to(room.id).emit('rit-complete', {
                    ...ritResults,
                    roomState: room.toJSON()
                });
            } else {
                // Run normally
                room.game.runOutBoard();
                const results = room.game.endHand();
                io.to(room.id).emit('hand-complete', {
                    results,
                    roomState: room.toJSON()
                });
            }
        }
    });

    // Rabbit hunt
    socket.on('rabbit-hunt', () => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.game) return;

        if (!RabbitHunt.isAvailable(room.game)) {
            socket.emit('error', { message: 'Rabbit hunt not available' });
            return;
        }

        const remainingCards = RabbitHunt.reveal(room.game);
        io.to(room.id).emit('rabbit-cards', {
            cards: remainingCards,
            completeBoard: RabbitHunt.getCompleteBoard(room.game)
        });
    });

    // Chat message
    socket.on('chat-message', ({ message }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (!player) return;

        const chatMessage = {
            playerId: socket.id,
            nickname: player.nickname,
            message,
            timestamp: Date.now()
        };

        room.addChatMessage(chatMessage);
        io.to(room.id).emit('chat-message', chatMessage);
    });

    // Pause game
    socket.on('pause-game', () => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        if (!room.isHost(socket.id)) {
            socket.emit('error', { message: 'Only host can pause' });
            return;
        }

        room.isPaused = true;
        stopPlayerTimer(room.id);

        io.to(room.id).emit('game-paused', {
            roomState: room.toJSON()
        });
    });

    // Update settings
    socket.on('update-settings', ({ settings }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        if (!room.isHost(socket.id)) {
            socket.emit('error', { message: 'Only host can update settings' });
            return;
        }

        room.updateSettings(settings);

        io.to(room.id).emit('settings-updated', {
            settings: room.settings
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (player) {
            // Mark player as inactive in scoreboard (scoreboard is at Room level)
            // Do this BEFORE removing player so we can access their data
            room.markPlayerInactiveInScoreboard(socket.id, player);

            room.removePlayer(socket.id);

            io.to(room.id).emit('player-left', {
                playerId: socket.id,
                nickname: player.nickname
            });

            // Broadcast updated room state with scoreboard (scoreboard is at Room level, so always send)
            io.to(room.id).emit('room-state', room.toJSON());

            // Clean up if room is empty
            if (room.players.length === 0) {
                stopPlayerTimer(room.id);
                roomManager.deleteRoom(room.id);
            }
        }
    });
}

// Helper functions for timer management
function startPlayerTimer(io, room) {
    if (!room.game || !room.game.bettingRound) return;

    // Check if betting round is complete before trying to start timer
    if (room.game.bettingRound.isComplete()) {
        // Betting round is complete, advance street or end hand
        const showdownResults = room.game.advanceStreet();
        if (showdownResults) {
            io.to(room.id).emit('hand-complete', {
                results: showdownResults,
                roomState: room.toJSON()
            });
            // Auto-start next hand after 5 seconds
            setTimeout(() => {
                try {
                    const currentRoom = roomManager.getRoom(room.id);
                    if (!currentRoom) return;

                    // Process stand up requests
                    for (const player of currentRoom.players) {
                        if (player.standUpNextHand) {
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            if (currentRoom.scoreboard.has(player.socketId)) {
                                const stats = currentRoom.scoreboard.get(player.socketId);
                                stats.stack = player.stack;
                            }
                        }
                    }

                    io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());

                    const seatedPlayers = currentRoom.getSeatedPlayers();
                    if (seatedPlayers.length < 2) {
                        currentRoom.game = null;
                        io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());
                        return;
                    }

                    const newGameState = currentRoom.game.startNewHand();

                    for (const player of currentRoom.game.players) {
                        io.to(player.socketId).emit('deal-cards', {
                            holeCards: player.holeCards
                        });
                    }

                    io.to(currentRoom.id).emit('new-hand', {
                        gameState: newGameState,
                        roomState: currentRoom.toJSON()
                    });

                    startPlayerTimer(io, currentRoom);
                } catch (error) {
                    console.error('[ERROR] Auto-start failed after all-in:', error);
                    io.to(room.id).emit('error', { message: 'Failed to start next hand' });
                }
            }, 5000);
        } else {
            // Advanced to next street, start timer for first player
            io.to(room.id).emit('room-state', room.toJSON());
            startPlayerTimer(io, room);
        }
        return;
    }

    const currentPlayer = room.game.bettingRound.getCurrentPlayer();
    if (!currentPlayer) return;
    
    // Don't start timer for all-in or folded players
    // moveToNextPlayer should have skipped them, but double-check
    if (currentPlayer.status !== 'active') {
        // Skip to next active player
        room.game.bettingRound.moveToNextPlayer();
        const nextPlayer = room.game.bettingRound.getCurrentPlayer();
        if (nextPlayer && nextPlayer.status === 'active') {
            // Recursively try again with the next player
            startPlayerTimer(io, room);
        }
        // If no active player found, isComplete should catch it on next call
        return;
    }

    const timer = new PlayerTimer(
        currentPlayer,
        room.settings.actionTimer,
        currentPlayer.timeBank,
        io,
        room.id
    );

    activeTimers.set(room.id, timer);
    timer.start();

    // Handle timeout - process fold action through game logic
    timer.setOnExpire(() => {
        // Stop the timer
        stopPlayerTimer(room.id);

        // Process fold action through game
        const result = room.game.processAction(currentPlayer, 'fold', 0);

        if (!result.success) {
            console.error('[ERROR] Failed to auto-fold on timeout:', result.message);
            // Try to continue anyway
            if (room.game.bettingRound && !room.game.bettingRound.isComplete()) {
                startPlayerTimer(io, room);
            }
            return;
        }

        // Broadcast action
        io.to(room.id).emit('player-acted', {
            playerId: currentPlayer.socketId,
            action: result.action || 'fold',
            timeout: true,
            gameState: room.game.toJSON(),
            roomState: room.toJSON()
        });

        // Check if hand ended with showdown results
        if (result.showdownResults) {
            io.to(room.id).emit('hand-complete', {
                results: result.showdownResults,
                roomState: room.toJSON()
            });

            // Auto-start next hand after 5 seconds
            setTimeout(() => {
                try {
                    const currentRoom = roomManager.getRoom(room.id);
                    if (!currentRoom) return;

                    // Process stand up requests
                    for (const player of currentRoom.players) {
                        if (player.standUpNextHand) {
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            if (currentRoom.scoreboard.has(player.socketId)) {
                                const stats = currentRoom.scoreboard.get(player.socketId);
                                stats.stack = player.stack;
                            }
                        }
                    }

                    io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());

                    const seatedPlayers = currentRoom.getSeatedPlayers();
                    if (seatedPlayers.length < 2) {
                        currentRoom.game = null;
                        io.to(currentRoom.id).emit('room-state', currentRoom.toJSON());
                        return;
                    }

                    const newGameState = currentRoom.game.startNewHand();

                    for (const player of currentRoom.game.players) {
                        io.to(player.socketId).emit('deal-cards', {
                            holeCards: player.holeCards
                        });
                    }

                    io.to(currentRoom.id).emit('new-hand', {
                        gameState: newGameState,
                        roomState: currentRoom.toJSON()
                    });

                    startPlayerTimer(io, currentRoom);
                } catch (error) {
                    console.error('[ERROR] Auto-start failed after timeout:', error);
                    io.to(room.id).emit('error', { message: 'Failed to start next hand' });
                }
            }, 5000);
            return;
        }

        // Check for Run It Twice opportunity
        if (RunItTwice.isApplicable(room.game)) {
            const involvedPlayers = RunItTwice.getInvolvedPlayers(room.game);
            io.to(room.id).emit('rit-prompt', {
                players: involvedPlayers.map(p => p.socketId)
            });
            return;
        }

        // Continue game - start timer for next player if betting continues
        if (room.game.bettingRound && !room.game.bettingRound.isComplete()) {
            startPlayerTimer(io, room);
        }
    });
}

function stopPlayerTimer(roomId) {
    const timer = activeTimers.get(roomId);
    if (timer) {
        timer.stop();
        activeTimers.delete(roomId);
    }
}
