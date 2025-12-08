export class Room {
    constructor(id, settings = {}) {
        this.id = id;
        this.hostSocketId = null;
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
        this.handCount = 0;
        this.chatHistory = [];
        this.scoreboard = new Map(); // Track all players who have played (socketId -> player stats)
    }

    addPlayer(player) {
        if (this.players.length >= this.settings.maxPlayers) {
            throw new Error('Room is full');
        }

        // Set first player as host
        if (this.players.length === 0) {
            this.hostSocketId = player.socketId;
        }

        this.players.push(player);
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            this.players.splice(index, 1);

            // Reassign host if needed
            if (this.hostSocketId === socketId && this.players.length > 0) {
                this.hostSocketId = this.players[0].socketId;
            }
        }
    }

    getPlayer(socketId) {
        return this.players.find(p => p.socketId === socketId);
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
     * Mark a player as inactive in scoreboard (when they leave)
     */
    markPlayerInactiveInScoreboard(socketId, player = null) {
        // Get player from room if not provided
        if (!player) {
            player = this.getPlayer(socketId);
        }

        if (this.scoreboard.has(socketId)) {
            const stats = this.scoreboard.get(socketId);
            stats.isActive = false;
            // Update final stack from player
            if (player) {
                stats.stack = player.stack;
            }
        } else if (player) {
            // Player not in scoreboard yet, add them now with their final stats
            this.scoreboard.set(socketId, {
                socketId: player.socketId,
                nickname: player.nickname,
                buyin: player.buyin,
                stack: player.stack,
                isActive: false
            });
        }
    }

    toJSON() {
        return {
            id: this.id,
            hostSocketId: this.hostSocketId,
            settings: this.settings,
            players: this.players.map(p => p.toJSON()),
            isPaused: this.isPaused,
            handCount: this.handCount,
            gameState: this.game ? this.game.toJSON() : null,
            scoreboard: Array.from(this.scoreboard.values())
        };
    }
}
