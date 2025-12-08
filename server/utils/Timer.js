export class Timer {
    constructor(duration, onTick, onExpire) {
        this.duration = duration; // seconds
        this.remaining = duration;
        this.onTick = onTick; // callback(remaining)
        this.onExpire = onExpire; // callback()
        this.interval = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.interval = setInterval(() => {
            this.remaining--;

            if (this.onTick) {
                this.onTick(this.remaining);
            }

            if (this.remaining <= 0) {
                this.stop();
                if (this.onExpire) {
                    this.onExpire();
                }
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
    }

    reset(duration = null) {
        this.stop();
        if (duration !== null) {
            this.duration = duration;
        }
        this.remaining = this.duration;
    }

    addTime(seconds) {
        this.remaining += seconds;
        if (this.remaining > this.duration) {
            this.remaining = this.duration;
        }
    }

    getRemaining() {
        return this.remaining;
    }
}

export class PlayerTimer {
    constructor(player, actionTime, timeBank, io, roomId) {
        this.player = player;
        this.actionTime = actionTime;
        this.timeBank = timeBank;
        this.io = io;
        this.roomId = roomId;
        this.usingTimeBank = false;
        this.customOnExpire = null; // Allow custom expire handler to be set

        this.timer = new Timer(
            actionTime,
            (remaining) => this.onTick(remaining),
            () => this.onExpire()
        );
    }

    start() {
        this.timer.start();
    }

    stop() {
        this.timer.stop();
    }

    onTick(remaining) {
        // Emit timer update to room
        this.io.to(this.roomId).emit('timer-tick', {
            playerId: this.player.socketId,
            remaining,
            usingTimeBank: this.usingTimeBank
        });

        // Switch to time bank when action timer expires
        if (remaining <= 0 && !this.usingTimeBank && this.player.timeBank > 0) {
            this.usingTimeBank = true;
            this.timer.reset(this.player.timeBank);
            this.timer.start();
        }
    }

    onExpire() {
        // Call custom expire handler if set, otherwise use default
        if (this.customOnExpire) {
            this.customOnExpire();
        } else {
            // Default: just emit timeout event
            this.io.to(this.roomId).emit('player-timeout', {
                playerId: this.player.socketId
            });
        }
    }

    setOnExpire(handler) {
        this.customOnExpire = handler;
    }

    useTimeBank() {
        if (!this.usingTimeBank && this.player.timeBank > 0) {
            this.usingTimeBank = true;
            this.timer.reset(this.player.timeBank);
            this.timer.start();
        }
    }
}
