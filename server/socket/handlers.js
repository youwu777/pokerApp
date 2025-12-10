import { roomManager } from '../utils/roomManager.js';
import { Player } from '../models/Player.js';
import { PokerGame } from '../engine/PokerGame.js';
import { RunItTwice } from '../engine/RunItTwice.js';
import { RabbitHunt } from '../engine/RabbitHunt.js';
import { PlayerTimer } from '../utils/Timer.js';
import { v4 as uuidv4 } from 'uuid';

const activeTimers = new Map(); // roomId -> timer
const DISCONNECT_RETENTION_MS = 5 * 60 * 1000; // Keep state for 5 minutes

export function setupSocketHandlers(io, socket) {

    const scoreboardKey = (player) => player?.playerId || player?.sessionToken || player?.socketId;

    const migrateScoreboardKey = (room, oldKey, newKey) => {
        if (!oldKey || !newKey || oldKey === newKey) return;
        if (!room.scoreboard.has(oldKey)) return;
        const entry = room.scoreboard.get(oldKey);
        room.scoreboard.delete(oldKey);
        room.scoreboard.set(newKey, { ...entry, playerId: newKey });
    };

    const upsertScoreboard = (room, player, isActive = true) => {
        const key = scoreboardKey(player);
        if (!key) return;
        const existing = room.scoreboard.get(key) || {};
        room.scoreboard.set(key, {
            playerId: key,
            sessionToken: player.sessionToken,
            socketId: player.socketId,
            nickname: player.nickname,
            buyin: player.buyin,
            stack: player.stack,
            isActive,
            isConnected: player.isConnected !== false,
            ...existing
        });
    };

    // Join room
    socket.on('join-room', ({ roomId, nickname, buyinAmount, sessionToken }) => {
        // First, check if socket is already in a different room and leave it
        // This prevents sockets from being in multiple Socket.IO rooms simultaneously
        const previousRoom = roomManager.getRoomBySocketId(socket.id);
        if (previousRoom && previousRoom.id !== roomId) {
            console.log(`[JOIN] Socket ${socket.id} leaving previous room ${previousRoom.id} before joining ${roomId}`);
            // Leave the Socket.IO room to prevent receiving events from both rooms
            socket.leave(previousRoom.id);
            
            // Remove player from previous room when switching to a different room
            const previousPlayer = previousRoom.getPlayer(socket.id);
            if (previousPlayer) {
                previousRoom.removePlayer(socket.id);
                io.to(previousRoom.id).emit('player-left', {
                    playerId: previousPlayer.sessionToken || previousPlayer.socketId,
                    nickname: previousPlayer.nickname
                });
                io.to(previousRoom.id).emit('room-state', previousRoom.toJSON());
            }
        }

        const room = roomManager.getRoom(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Ensure we have a stable session token
        let stableToken = sessionToken || uuidv4();

        try {
            const buyin = buyinAmount || 1000;
            console.log(`[JOIN] ${nickname} joining with buyin: ${buyin} (type: ${typeof buyin}), token: ${stableToken}`);

            // Check for existing session
            let player = room.getPlayerBySession(stableToken);

            if (player) {
                const previousSocketId = player.socketId;
                // Enforce single connection per sessionToken: disconnect old socket if different
                if (player.socketId && player.socketId !== socket.id) {
                    const oldSocket = io.sockets.sockets.get(player.socketId);
                    if (oldSocket) {
                        console.log(`[SESSION] Disconnecting old socket for token ${stableToken}`);
                        oldSocket.disconnect(true);
                    }
                }

                // Migrate old scoreboard key (from old socketId/sessionToken) to playerId
                migrateScoreboardKey(room, previousSocketId, player.playerId);
                migrateScoreboardKey(room, stableToken, player.playerId);

                // Rebind to new socket
                player.socketId = socket.id;
                player.isConnected = true;
                player.disconnectedAt = null;
                // Clear any pending disconnect cleanup
                if (room.disconnectTimeouts.has(stableToken)) {
                    clearTimeout(room.disconnectTimeouts.get(stableToken));
                    room.disconnectTimeouts.delete(stableToken);
                }

                // If this session is the host, rebind host socket
                if (room.isHostSession(player.sessionToken) || room.isHostPlayer(player.playerId)) {
                    room.hostSocketId = socket.id;
                }

                // Update host socket if needed
                if (room.hostSocketId === player.socketId || room.hostSocketId === null) {
                    room.hostSocketId = socket.id;
                }

                socket.join(roomId);
                upsertScoreboard(room, player, true);

                socket.emit('room-joined', {
                    roomId,
                    isHost: room.isHost(socket.id),
                    roomState: room.toJSON(),
                    sessionToken: stableToken
                });

                // Resend private hole cards if game in progress
                if (room.game) {
                    const me = room.game.players.find(p => p.sessionToken === stableToken);
                    if (me && me.holeCards?.length) {
                        io.to(socket.id).emit('deal-cards', { holeCards: me.holeCards });
                    }
                }

                // Notify others of reconnection
                io.to(roomId).emit('room-state', room.toJSON());
                console.log(`[JOIN] ${player.nickname} reconnected to room ${roomId}`);
                return;
            }

            // New player/session
            player = new Player(socket.id, nickname, buyin, stableToken);
            console.log(`[JOIN] Player created with stack: ${player.stack}`);
            room.addPlayer(player);
            socket.join(roomId);
            upsertScoreboard(room, player, true);

            // Send room state to new player (include sessionToken so client can persist)
            socket.emit('room-joined', {
                roomId,
                isHost: room.isHost(socket.id),
                roomState: room.toJSON(),
                sessionToken: stableToken
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

        // Check if player has stack to sit down
        if (player.stack === 0) {
            socket.emit('error', { message: 'Cannot sit down with 0 stack. Please request a buy-in first.' });
            return;
        }

        // Check if seat is available
        const seatTaken = room.players.some(p => p.seatNumber === seatNumber);
        if (seatTaken) {
            socket.emit('error', { message: 'Seat already taken' });
            return;
        }

        console.log(`[SIT] ${player.nickname} sitting with stack: ${player.stack}`);
        player.sitDown(seatNumber, room.settings.timeBank);
        console.log(`[SIT] ${player.nickname} chips after sitting: ${player.chips}`);

        // Add/update scoreboard (scoreboard is at Room level)
        upsertScoreboard(room, player, true);

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
        upsertScoreboard(room, player, true);

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
        
        // Check if betting round still exists (hand might have ended)
        const roundComplete = room.game.bettingRound ? room.game.bettingRound.isComplete() : 'N/A (hand ended)';
        console.log(`[ACTION] Success: ${result.action}, Round complete: ${roundComplete}, Has showdownResults: ${!!result.showdownResults}`);

        // Check if hand ended with showdown results BEFORE broadcasting action
        // This ensures hand-complete is sent first and frontend knows hand is over
        if (result.showdownResults) {
            console.log('[DEBUG] Hand ended with showdown results, emitting hand-complete FIRST');
            
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

                    // Process stand up requests and auto-stand-up players with 0 stack
                    for (const player of currentRoom.players) {
                        // Auto-stand-up players with 0 stack
                        if (player.seatNumber !== null && player.stack === 0) {
                            console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
                                stats.stack = player.stack;
                            }
                        } else if (player.standUpNextHand) {
                            console.log(`[DEBUG] ${player.nickname} standing up before next hand`);
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
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

            return; // Don't broadcast player-acted or continue game flow - hand is over
        }

        // Check if this is an all-in showdown that needs progressive card reveal
        if (result.cardsToReveal && result.allInShowdown) {
            console.log(`[ALL-IN] Starting progressive card reveal: ${result.cardsToReveal.length} cards`);
            
            // Broadcast action first (cards are NOT in communityCards yet)
            io.to(room.id).emit('player-acted', {
                playerId: socket.id,
                action: result.action,
                amount: player.currentBet,
                gameState: room.game.toJSON(),
                roomState: room.toJSON()
            });
            
            // Get current community cards count (before revealing new ones)
            const cardsBeforeReveal = room.game.communityCards.length;
            const cardsToReveal = result.cardsToReveal;
            
            // Start revealing cards one by one with 3 second delays
            cardsToReveal.forEach((card, index) => {
                setTimeout(() => {
                    const currentRoom = roomManager.getRoom(room.id);
                    if (!currentRoom || !currentRoom.game) return;
                    
                    // Add card to community cards as it's revealed
                    currentRoom.game.addCommunityCard(card);
                    
                    // Emit card reveal event
                    io.to(room.id).emit('card-reveal', {
                        card: card,
                        cardIndex: cardsBeforeReveal + index,
                        gameState: currentRoom.game.toJSON(),
                        roomState: currentRoom.toJSON()
                    });
                    
                    console.log(`[ALL-IN] Revealed card ${index + 1}/${cardsToReveal.length}: ${card}`);
                    
                    // After last card, end the hand
                    if (index === cardsToReveal.length - 1) {
                        setTimeout(() => {
                            const finalRoom = roomManager.getRoom(room.id);
                            if (!finalRoom || !finalRoom.game) return;
                            
                            const showdownResults = finalRoom.game.endHand();
                            console.log('[DEBUG] All-in showdown complete, emitting hand-complete');
                            
                            io.to(room.id).emit('hand-complete', {
                                results: showdownResults,
                                roomState: finalRoom.toJSON()
                            });
                            
                            // Auto-start next hand after 5 seconds
                            setTimeout(() => {
                                try {
                                    const currentRoom = roomManager.getRoom(room.id);
                                    if (!currentRoom) return;

                                    // Process stand up requests and auto-stand-up players with 0 stack
                                    for (const player of currentRoom.players) {
                                        if (player.seatNumber !== null && player.stack === 0) {
                                            console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                                            player.standUp();
                                            const key = player.playerId || player.sessionToken || player.socketId;
                                            if (currentRoom.scoreboard.has(key)) {
                                                const stats = currentRoom.scoreboard.get(key);
                                                stats.stack = player.stack;
                                            }
                                        } else if (player.standUpNextHand) {
                                            console.log(`[DEBUG] ${player.nickname} standing up before next hand`);
                                            player.standUp();
                                            const key = player.playerId || player.sessionToken || player.socketId;
                                            if (currentRoom.scoreboard.has(key)) {
                                                const stats = currentRoom.scoreboard.get(key);
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
                        }, 3000); // Wait 3 seconds after last card before ending hand
                    }
                }, index * 3000); // 3 second delay between each card
            });
            
            return; // Don't continue normal flow
        }

        // Broadcast action (only if hand didn't end)
        io.to(room.id).emit('player-acted', {
            playerId: socket.id,
            action: result.action,
            amount: player.currentBet,
            gameState: room.game.toJSON(),
            roomState: room.toJSON()
        });

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
                        const key = player.playerId || player.sessionToken || player.socketId;
                        if (room.scoreboard.has(key)) {
                            const stats = room.scoreboard.get(key);
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

    // Buy-in request
    socket.on('buyin-request', ({ amount }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const player = room.getPlayer(socket.id);
        if (!player) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }

        // Allow owners to request buy-ins too

        const buyinAmount = Number.parseInt(amount, 10);
        if (Number.isNaN(buyinAmount) || buyinAmount <= 0) {
            socket.emit('error', { message: 'Invalid buy-in amount' });
            return;
        }

        // Generate unique request ID
        const requestId = `${socket.id}-${Date.now()}`;
        
        // Store pending buy-in request
        room.pendingBuyIns.set(requestId, {
            requestId,
            playerId: player.playerId,
            nickname: player.nickname,
            amount: buyinAmount,
            timestamp: Date.now()
        });

        console.log(`[BUYIN] ${player.nickname} requested buy-in of $${buyinAmount}`);

        // Notify owner
        const hostSocket = io.sockets.sockets.get(room.hostSocketId);
        if (hostSocket) {
            hostSocket.emit('buyin-request-notification', {
                requestId,
                playerId: socket.id,
                nickname: player.nickname,
                amount: buyinAmount
            });
        }

        // Confirm to player
        socket.emit('buyin-request-sent', {
            requestId,
            amount: buyinAmount,
            status: 'pending'
        });
    });

    // Buy-in approve
    socket.on('buyin-approve', ({ requestId }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        // Check if requester is owner
        if (!room.isHost(socket.id)) {
            socket.emit('error', { message: 'Only room owner can approve buy-ins' });
            return;
        }

        const request = room.pendingBuyIns.get(requestId);
        if (!request) {
            socket.emit('error', { message: 'Buy-in request not found' });
            return;
        }

        const player = room.getPlayerById(request.playerId);
        if (!player) {
            socket.emit('error', { message: 'Player not found' });
            room.pendingBuyIns.delete(requestId);
            return;
        }

        // Remove from pending
        room.pendingBuyIns.delete(requestId);
        
        // If player is not seated, update stack immediately
        if (player.seatNumber === null) {
            console.log(`[BUYIN] Owner approved ${request.nickname}'s buy-in of $${request.amount} (not seated - updating immediately)`);
            player.stack += request.amount;
            player.buyin += request.amount;
            
            // Update scoreboard
            upsertScoreboard(room, player, true);
            
            // Notify all players of updated room state
            io.to(room.id).emit('room-state', room.toJSON());
        } else {
            // Player is seated, add to approved buy-ins (to be processed at next hand)
            const existingApproved = room.approvedBuyIns.get(request.playerId) || 0;
            room.approvedBuyIns.set(request.playerId, existingApproved + request.amount);
            console.log(`[BUYIN] Owner approved ${request.nickname}'s buy-in of $${request.amount} (seated - will process at next hand)`);
        }

        // Notify player
        const playerSocket = io.sockets.sockets.get(request.playerId);
        if (playerSocket) {
            playerSocket.emit('buyin-approved', {
                requestId,
                amount: request.amount
            });
        }

        // Confirm to owner
        socket.emit('buyin-approve-success', { requestId });
    });

    // Buy-in reject
    socket.on('buyin-reject', ({ requestId }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        // Check if requester is owner
        if (!room.isHost(socket.id)) {
            socket.emit('error', { message: 'Only room owner can reject buy-ins' });
            return;
        }

        const request = room.pendingBuyIns.get(requestId);
        if (!request) {
            socket.emit('error', { message: 'Buy-in request not found' });
            return;
        }

        // Remove from pending
        room.pendingBuyIns.delete(requestId);

        console.log(`[BUYIN] Owner rejected ${request.nickname}'s buy-in of $${request.amount}`);

        // Notify player
        const playerSocket = io.sockets.sockets.get(request.playerId);
        if (playerSocket) {
            playerSocket.emit('buyin-rejected', {
                requestId,
                amount: request.amount
            });
        }

        // Confirm to owner
        socket.emit('buyin-reject-success', { requestId });
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
            // Leave the Socket.IO room
            socket.leave(room.id);
            
            // Mark as disconnected but keep state for retention window
            player.isConnected = false;
            player.disconnectedAt = Date.now();
            upsertScoreboard(room, player, false);
            room.markPlayerInactiveInScoreboard(player.playerId || player.sessionToken || player.socketId, player);

            io.to(room.id).emit('player-disconnected', {
                playerId: player.sessionToken || player.socketId,
                nickname: player.nickname
            });

            // Broadcast updated room state with scoreboard (scoreboard is at Room level, so always send)
            io.to(room.id).emit('room-state', room.toJSON());

            // Schedule cleanup after retention window
            const timeoutId = setTimeout(() => {
                const stillRoom = roomManager.getRoom(room.id);
                if (!stillRoom) return;
                const existing = stillRoom.getPlayerBySession(player.sessionToken);
                if (existing && existing.isConnected === false) {
                    console.log(`[SESSION] Removing player ${existing.nickname} after retention timeout`);
                    stillRoom.removePlayerBySession(existing.sessionToken);
                    io.to(stillRoom.id).emit('player-left', {
                        playerId: existing.sessionToken || existing.socketId,
                        nickname: existing.nickname
                    });
                    io.to(stillRoom.id).emit('room-state', stillRoom.toJSON());
                    if (stillRoom.players.length === 0) {
                        stopPlayerTimer(stillRoom.id);
                        roomManager.deleteRoom(stillRoom.id);
                    }
                }
            }, DISCONNECT_RETENTION_MS);

            room.disconnectTimeouts.set(player.sessionToken || player.socketId, timeoutId);
        }
    });

    // Throw item at another player
    socket.on('throw-item', ({ itemId, targetPlayerId, targetSocketId }) => {
        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room) return;

        const fromPlayer = room.getPlayer(socket.id);
        if (!fromPlayer) return;

        const targetPlayer = room.getPlayerById
            ? (room.getPlayerById(targetPlayerId) || room.getPlayer(targetSocketId || targetPlayerId))
            : room.getPlayer(targetSocketId || targetPlayerId);

        if (!targetPlayer) {
            socket.emit('error', { message: 'Target player not found' });
            return;
        }

        // Can't throw at yourself
        if (fromPlayer.playerId === targetPlayer.playerId || fromPlayer.socketId === targetPlayer.socketId) {
            socket.emit('error', { message: 'Cannot throw items at yourself' });
            return;
        }

        // Validate item ID
        const validItems = ['tomato', 'egg', 'flipflops', 'boom'];
        if (!validItems.includes(itemId)) {
            socket.emit('error', { message: 'Invalid item' });
            return;
        }

        console.log(`[THROW] ${fromPlayer.nickname} (${fromPlayer.playerId}/${fromPlayer.socketId}) -> ${targetPlayer.nickname} (${targetPlayer.playerId}/${targetPlayer.socketId}) item=${itemId}`);

        // Broadcast to all players in the room
        io.to(room.id).emit('item-thrown', {
            fromPlayerId: fromPlayer.playerId || fromPlayer.socketId,
            fromSocketId: fromPlayer.socketId,
            targetPlayerId: targetPlayer.playerId || targetPlayer.socketId,
            targetSocketId: targetPlayer.socketId,
            itemId: itemId
        });

        console.log(`[THROW] ${fromPlayer.nickname} threw ${itemId} at ${targetPlayer.nickname}`);
    });

    // Rabbit Hunt - Reveal undealt community cards
    socket.on('rabbit-hunt', () => {
        console.log('[RABBIT-HUNT] Player triggered rabbit hunt:', socket.id);

        const room = roomManager.getRoomBySocketId(socket.id);
        if (!room || !room.game) {
            console.log('[RABBIT-HUNT] No room or game found');
            return;
        }

        // Check if rabbit hunt is allowed
        if (!room.settings.allowRabbitHunt) {
            socket.emit('error', { message: 'Rabbit hunt is disabled in this room' });
            return;
        }

        // Trigger rabbit hunt
        const result = room.game.triggerRabbitHunt();

        if (!result.success) {
            console.log('[RABBIT-HUNT] Failed:', result.message);
            socket.emit('error', { message: result.message });
            return;
        }

        // Broadcast revealed cards to all players in the room
        console.log('[RABBIT-HUNT] Success! Revealing cards:', result.cards);
        io.to(room.id).emit('rabbit-hunt-revealed', {
            cards: result.cards,
            communityCardsIfDealt: result.communityCardsIfDealt,
            gameState: room.game.toJSON()
        });
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

                    // Process stand up requests and auto-stand-up players with 0 stack
                    for (const player of currentRoom.players) {
                        // Auto-stand-up players with 0 stack
                        if (player.seatNumber !== null && player.stack === 0) {
                            console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
                                stats.stack = player.stack;
                            }
                        } else if (player.standUpNextHand) {
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
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
        // If no active player found, check if round is complete
        if (room.game.bettingRound.isComplete()) {
            startPlayerTimer(io, room); // Will handle completion
        }
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

                    // Process stand up requests and auto-stand-up players with 0 stack
                    for (const player of currentRoom.players) {
                        // Auto-stand-up players with 0 stack
                        if (player.seatNumber !== null && player.stack === 0) {
                            console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
                                stats.stack = player.stack;
                            }
                        } else if (player.standUpNextHand) {
                            player.standUp();
                            // Update scoreboard with final stack (scoreboard is at Room level)
                            const key = player.playerId || player.sessionToken || player.socketId;
                            if (currentRoom.scoreboard.has(key)) {
                                const stats = currentRoom.scoreboard.get(key);
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
