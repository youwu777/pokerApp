export class Player {
    constructor(socketId, nickname, buyinAmount = 1000) {
        this.socketId = socketId;
        this.nickname = nickname;
        this.buyin = buyinAmount; // Original buyin amount (never changes)
        this.stack = buyinAmount; // Persistent stack that stays with player in room
        this.seatNumber = null; // null = not seated, 0-9 = seat position
        this.chips = 0;
        this.currentBet = 0;
        this.holeCards = [];
        this.status = 'waiting'; // waiting, active, folded, all-in
        this.timeBank = 0; // Will be set from room settings when seated
        this.hasActed = false;
        this.lastAction = null; // fold, check, call, bet, raise, all-in
        this.position = null; // BTN, SB, BB, UTG, etc.
        this.standUpNextHand = false;
    }

    sitDown(seatNumber, timeBank) {
        this.seatNumber = seatNumber;
        this.chips = this.stack; // Restore chips from persistent stack
        this.timeBank = timeBank;
        this.status = 'active';
        this.standUpNextHand = false;
    }

    standUp() {
        this.stack = this.chips; // Save current chips to persistent stack
        this.seatNumber = null;
        this.chips = 0;
        this.status = 'waiting';
        this.holeCards = [];
        this.currentBet = 0;
        this.standUpNextHand = false;
    }

    bet(amount) {
        const actualBet = Math.min(amount, this.chips);
        this.chips -= actualBet;
        this.currentBet += actualBet;

        if (this.chips === 0) {
            this.status = 'all-in';
        }

        return actualBet;
    }

    fold() {
        this.status = 'folded';
        this.lastAction = 'fold';
        this.hasActed = true;
    }

    resetForNewHand() {
        this.currentBet = 0;
        this.holeCards = [];
        this.hasActed = false;
        this.lastAction = null;

        if (this.status !== 'all-in') {
            this.status = 'active';
        }
    }

    resetForNewRound() {
        this.currentBet = 0;
        this.hasActed = false;
    }

    toJSON() {
        return {
            socketId: this.socketId,
            nickname: this.nickname,
            buyin: this.buyin,
            stack: this.stack,
            seatNumber: this.seatNumber,
            chips: this.chips,
            currentBet: this.currentBet,
            status: this.status,
            timeBank: this.timeBank,
            lastAction: this.lastAction,
            position: this.position,
            standUpNextHand: this.standUpNextHand,
            // Don't include hole cards in public JSON
        };
    }
}
