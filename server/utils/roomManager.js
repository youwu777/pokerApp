import { Room } from '../models/Room.js';

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
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.players.length === 0) {
                this.deleteRoom(roomId);
                console.log(`Deleted empty room: ${roomId}`);
            }
        }
    }
}

export const roomManager = new RoomManager();

// Cleanup empty rooms every 5 minutes
setInterval(() => {
    roomManager.cleanupEmptyRooms();
}, 5 * 60 * 1000);
