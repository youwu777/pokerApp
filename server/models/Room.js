export class Room {
    constructor(id, settings = {}) {
        this.id = id;
        this.hostSocketId = null;
        this.hostSessionToken = null;
        this.hostPlayerId = null;
        this.settings = {
            smallBlind: settings.smallBlind || 10,
            bigBlind: settings.bigBlind || 20,
            actionTimer: settings.actionTimer || 15, // seconds
            timeBank: settings.timeBank || 10, // seconds
            allowRunItTwice: settings.allowRunItTwice ?? true,
            allowRabbitHunt: settings.allowRabbitHunt ?? true,
            handLimit: settings.handLimit || null, // null = unlimited
            maxPlayers: 10
        };
        this.players = []; // Array of Player objects
        this.game = null; // PokerGame instance when active
        this.isPaused = false;
        this.endGameAfterHand = false; // Flag to end game after current hand completes
        this.handCount = 0;
        this.chatHistory = [];
        this.scoreboard = new Map(); // Track all players who have played (playerId -> player stats)
        this.pendingBuyIns = new Map(); // Track pending buy-in requests (requestId -> {playerId, nickname, amount, timestamp})
        this.approvedBuyIns = new Map(); // Track approved buy-ins to be added at next hand (playerId -> amount)
        this.disconnectTimeouts = new Map(); // sessionToken -> timeout id for retention cleanup
    }

    addPlayer(player) {
        if (this.players.length >= this.settings.maxPlayers) {
            throw new Error('Room is full');
        }

        // Set first player as host
        if (this.players.length === 0) {
            this.hostSocketId = player.socketId;
            this.hostSessionToken = player.sessionToken || null;
            this.hostPlayerId = player.playerId || null;
        }

        this.players.push(player);
    }

    getPlayerBySession(sessionToken) {
        return this.players.find(p => p.sessionToken === sessionToken);
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.playerId === playerId);
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.playerId === playerId);
    }

    removePlayerBySession(sessionToken) {
        const index = this.players.findIndex(p => p.sessionToken === sessionToken);
        if (index !== -1) {
            const [player] = this.players.splice(index, 1);
            // Clear any retention timers
            if (this.disconnectTimeouts.has(sessionToken)) {
                clearTimeout(this.disconnectTimeouts.get(sessionToken));
                this.disconnectTimeouts.delete(sessionToken);
            }
            // Reassign host if needed
            if (this.hostSocketId === player.socketId && this.players.length > 0) {
                this.hostSocketId = this.players[0].socketId;
                this.hostSessionToken = this.players[0].sessionToken || null;
                this.hostPlayerId = this.players[0].playerId || null;
            }
            return player;
        }
        return null;
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            const [removed] = this.players.splice(index, 1);

            // Reassign host if needed
            if (this.hostSocketId === socketId && this.players.length > 0) {
                this.hostSocketId = this.players[0].socketId;
                this.hostSessionToken = this.players[0].sessionToken || null;
                this.hostPlayerId = this.players[0].playerId || null;
            } else if (removed && removed.sessionToken && removed.sessionToken === this.hostSessionToken && this.players.length > 0) {
                this.hostSocketId = this.players[0].socketId;
                this.hostSessionToken = this.players[0].sessionToken || null;
                this.hostPlayerId = this.players[0].playerId || null;
            }
        }
    }

    getPlayer(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }

    isHostSession(sessionToken) {
        return !!sessionToken && sessionToken === this.hostSessionToken;
    }

    isHostPlayer(playerId) {
        return !!playerId && playerId === this.hostPlayerId;
    }

    getSeatedPlayers() {
        return this.players.filter(p => p.seatNumber !== null);
    }

    isHost(socketId) {
        return this.hostSocketId === socketId;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    addChatMessage(message) {
        this.chatHistory.push({
            timestamp: Date.now(),
            ...message
        });

        // Keep only last 100 messages
        if (this.chatHistory.length > 100) {
            this.chatHistory.shift();
        }
    }

    /**
     * Mark a player as inactive in scoreboard (when they leave/disconnect)
     */
    markPlayerInactiveInScoreboard(key, player = null) {
        // Get player from room if not provided
        if (!player) {
            player = this.getPlayerById(key) || this.getPlayerBySession(key);
        }

        if (this.scoreboard.has(key)) {
            const stats = this.scoreboard.get(key);
            stats.isActive = false;
            stats.isConnected = false;
            // Update final stack from player
            if (player) {
                stats.stack = player.stack;
                stats.socketId = player.socketId;
                stats.playerId = player.playerId;
                stats.sessionToken = player.sessionToken;
            }
        } else if (player) {
            // Player not in scoreboard yet, add them now with their final stats
            this.scoreboard.set(key, {
                socketId: player.socketId,
                sessionToken: player.sessionToken,
                playerId: player.playerId,
                nickname: player.nickname,
                buyin: player.buyin,
                stack: player.stack,
                isActive: false,
                isConnected: false
            });
        }
    }

    toJSON() {
        // Ensure scoreboard only contains players from this room
        const roomScoreboard = Array.from(this.scoreboard.values()).map(entry => ({
            sessionToken: entry.sessionToken || entry.socketId,
            playerId: entry.playerId || entry.sessionToken || entry.socketId,
            ...entry
        })).filter(entry => {
            // Only include entries for players who are or were in this room
            const playerInRoom = this.players.some(p => 
                p.sessionToken === entry.sessionToken || p.socketId === entry.socketId || p.playerId === entry.playerId
            );
            return playerInRoom || !entry.isActive; // Include active players or inactive players who were in this room
        });
        
        return {
            id: this.id,
            hostSocketId: this.hostSocketId,
            settings: this.settings,
            players: this.players.map(p => p.toJSON()),
            isPaused: this.isPaused,
            handCount: this.handCount,
            gameState: this.game ? this.game.toJSON() : null,
            scoreboard: roomScoreboard, // Only include scoreboard entries for this room
            chatHistory: this.chatHistory // Include chat history for reconnection
        };
    }
}
