import { Room } from '../models/Room.js';

class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    createRoom(roomId, settings) {
        const room = new Room(roomId, settings);
        this.rooms.set(roomId, room);
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
