import { Room } from '../models/Room.js';

const ROOM_TIMEOUT_MS = 15 * 60 * 1000; // Delete room after 15 minutes of inactivity

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomId, settings) {
        // Check if room already exists - if so, delete it first to ensure fresh state
        if (this.rooms.has(roomId)) {
            console.log(`[ROOM] Room ${roomId} already exists, deleting old instance`);
            this.deleteRoom(roomId);
        }
        const room = new Room(roomId, settings);
        this.rooms.set(roomId, room);
        console.log(`[ROOM] Created new room ${roomId} with fresh scoreboard (size: ${room.scoreboard.size})`);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }

    getRoomBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            if (room.getPlayer(socketId)) {
                return room;
            }
        }
        return null;
    }

    cleanupEmptyRooms() {
        // Don't delete rooms immediately - let the room timeout handle it
        // This allows players to reconnect within 15 minutes
        for (const [roomId, room] of this.rooms.entries()) {
            // Only delete if room has been empty for 15+ minutes (timeout already set)
            // The timeout is set in the disconnect handler when all players are removed
            if (room.players.length === 0 && !room.roomTimeoutId) {
                // Room is empty but no timeout set - this shouldn't happen, but set one now
                console.log(`[ROOM] Room ${roomId} is empty, setting 15-minute timeout`);
                room.roomTimeoutId = setTimeout(() => {
                    const finalRoom = this.getRoom(roomId);
                    if (finalRoom && finalRoom.players.length === 0) {
                        console.log(`[ROOM] Deleting room ${roomId} after 15 minutes of inactivity`);
                        this.deleteRoom(roomId);
                    }
                }, ROOM_TIMEOUT_MS);
            }
        }
    }
}

export const roomManager = new RoomManager();

// Cleanup empty rooms every 5 minutes
setInterval(() => {
    roomManager.cleanupEmptyRooms();
}, 5 * 60 * 1000);
