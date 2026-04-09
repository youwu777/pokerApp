# Texas Hold'em Poker Socket.IO Application

## Overview

This document describes the architecture, data models, and Socket.IO event protocol for a real-time Texas Hold'em poker application. The system uses Node.js with Express for the server, Socket.IO for bidirectional communication, and a client-side React context to manage socket connections.

## Architecture

```mermaid
graph TB
    subgraph Client["Client (React + Socket.IO Client)"]
        C1[SocketContext]
        C2[Components]
        C3[Local State]
    end

    subgraph Server["Server (Node.js + Express + Socket.IO)"]
        S1[HTTP Server]
        S2[Socket.IO Server]
        S3[Game Logic]
        S4[Room Management]
        S5[Timer Utilities]
    end

    C1 <-->|"WebSocket"| S2
    S1 -->|static files| C2
    S3 -->|emits| S2
    S4 -->|emits| S2
    S5 -->|triggers| S4
    S2 -->|receives| S4
    S2 -->|receives| S3
```

## Module Structure

```mermaid
erDiagram
    SERVER_INDEX ||--|| SOCKET_HANDLERS : "imports"
    SOCKET_HANDLERS ||--|| ROOM_MANAGER : "imports"
    ROOM_MANAGER ||--|| POKER_GAME : "imports"
    ROOM_MANAGER ||--|| TIMER : "imports"
    SERVER_INDEX ||--|| CLIENT_SOCKET : "connects"
```

### Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| `index.js` (server) | `server/index.js` | HTTP/Socket.IO server initialization |
| `handlers.js` | `server/socket/handlers.js` | Socket event routing and response |
| `roomManager.js` | `server/utils/roomManager.js` | Player/room lifecycle management |
| `PokerGame.js` | `server/utils/PokerGame.js` | Core game state and rules |
| `Timer.js` | `server/utils/Timer.js` | Round/action timing utilities |
| `SocketContext.jsx` | `client/src/contexts/SocketContext.jsx` | Client socket connection management |
| `poker-engine.js` | `client/src/utils/poker-engine.js` | Card combinations and hand evaluation |

## Data Models

### `Room` Model

```mermaid
erDiagram
    ROOM {
        string roomId PK
        string name
        string hostToken
        string hostSocketId
        Player[] players
        PokerGame game PK
        number maxPlayers
        string status
        object settings
    }

    PLAYER {
        string playerSocketId PK
        string name
        number stack
        boolean isHost
        boolean sitOut
        string seatIndex
    }

    ROOM ||--o{ PLAYER : "contains"
```

**Source Code:**

```javascript
// server/utils/roomManager.js
const roomStorage = new Map();
```

### `Player` Model

```mermaid
erDiagram
    PLAYER {
        string playerSocketId PK
        string name
        number stack
        boolean isHost
        boolean sitOut
        string seatIndex
    }
```

**Source Code:**

```javascript
// server/utils/roomManager.js
class Player {
  constructor(playerSocketId, name, stack, isHost = false) {
    this.playerSocketId = playerSocketId;
    this.name = name;
    this.stack = stack;
    this.isHost = isHost;
    this.sitOut = false;
    this.seatIndex = null;
  }
}
```

### `PokerGame` Model

```mermaid
erDiagram
    POKER_GAME {
        number dealerBtn PK
        string currentTurn
        number pot
        array communityCards
        number lastRaise
        string phase
        object lastAction
    }

    POKER_GAME ||--|| POKER_ENGINE : "uses"
```

**Source Code:**

```javascript
// server/utils/PokerGame.js
class PokerGame {
  constructor(players, bigBlind, buyIn) {
    this.dealerBtn = 0;
    this.currentTurn = null;
    this.pot = 0;
    this.communityCards = [];
    this.players = players;
    this.lastRaise = bigBlind;
    this.phase = 'preflop';
    this.lastAction = null;
    this.bigBlind = bigBlind;
    this.buyIn = buyIn;
  }
}
```

### Scoreboard Model

```mermaid
erDiagram
    SCOREBOARD_ENTRY {
        string sessionToken PK
        number wins
        number losses
        number chips
        string playerName
        number gamesPlayed
        number peakChips
    }
```

**Source Code:**

```javascript
// server/utils/scoreboard.js
function upsertScoreboard(sessionToken, data) {
  const entry = scoreboard.get(sessionToken) || {
    sessionToken,
    wins: 0,
    losses: 0,
    chips: 0,
    playerName: data.playerName,
    gamesPlayed: 0,
    peakChips: 0,
  };
}
```

### `Timer` Model

```mermaid
erDiagram
    TIMER {
        number duration PK
        function onExpire PK
        function onTick PK
    }
```

**Source Code:**

```javascript
// server/utils/Timer.js
class Timer {
  constructor(duration, onExpire, onTick) {
    this.duration = duration;
    this.onExpire = onExpire;
    this.onTick = onTick;
    this.interval = null;
  }
}
```

## Socket.IO Event Protocol

### Event Flow Overview

```mermaid
flowchart LR
    subgraph Client["Client"]
        C1[game:join]
        C2[game:start]
        C3[game:leave]
        C4[game:action]
        C5[game:timerExpired]
        C6[game:sitDown]
        C7[game:standUp]
        C8[game:updateSettings]
    end

    subgraph Server["Server"]
        S1[player:joined]
        S2[game:started]
        S3[player:left]
        S4[state:updated]
        S5[game:roundEnd]
        S6[game:ended]
        S7[error:message]
        S8[game:settingsUpdated]
    end

    C1 -->|emit| S1
    C2 -->|emit| S2
    C3 -->|emit| S3
    C4 -->|emit| S4
    C5 -->|emit| S5
    C6 -->|emit| S8
    C7 -->|emit| S4
    C4 -->|emit| S5
    C2 -->|emit| S4
```

### Client → Server Events

| Event | Payload | Handler | Description |
|-------|---------|---------|-------------|
| `game:join` | `{ name, stack, sessionToken }` | join | Player joins a room |
| `game:start` | `{ hostToken }` | start | Host initiates game |
| `game:leave` | `{}` | leave | Player leaves room |
| `game:action` | `{ action, amount? }` | action | Player submits action |
| `game:timerExpired` | `{}` | timerExpired | Timer expired notification |
| `game:sitDown` | `{ seatIndex }` | sitDown | Player sits at table |
| `game:standUp` | `{}` | standUp | Player stands from table |
| `game:updateSettings` | `{ settings }` | updateSettings | Host updates game settings |

**Source Code:**

```javascript
// server/socket/handlers.js
socket.on('game:join', (data) => handleJoin(socket, data));
socket.on('game:start', (data) => handleStart(socket, data));
socket.on('game:leave', (data) => handleLeave(socket, data));
socket.on('game:action', (data) => handleAction(socket, data));
socket.on('game:timerExpired', (data) => handleTimerExpired(socket, data));
socket.on('game:sitDown', (data) => handleSitDown(socket, data));
socket.on('game:standUp', () => handleStandUp(socket));
socket.on('game:updateSettings', (data) => handleUpdateSettings(socket, data));
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `player:joined` | `{ room, players, sessionToken }` | Confirmation of join |
| `player:left` | `{ playerSocketId, room }` | Player departure notification |
| `game:started` | `{ room }` | Game start confirmation |
| `state:updated` | `{ room }` | Updated game state |
| `game:roundEnd` | `{ room, event }` | Round completion (flop/turn/river/showdown) |
| `game:ended` | `{ room, event }` | Game completion |
| `game:settingsUpdated` | `{ settings }` | Settings changed |
| `error:message` | `{ message, code }` | Error notification |

**Source Code:**

```javascript
// server/socket/handlers.js
socket.emit('player:joined', { room, players, sessionToken });
socket.emit('player:left', { playerSocketId, room });
socket.emit('game:started', { room });
socket.to(targetRoom).emit('state:updated', { room });
socket.to(targetRoom).emit('game:roundEnd', { room, event });
socket.to(targetRoom).emit('game:ended', { room, event });
socket.to(targetRoom).emit('game:settingsUpdated', { settings });
socket.emit('error:message', { message, code });
```

## Server Runtime Sequence

```mermaid
sequenceDiagram
    title Server Runtime Sequence
    participant Client
    participant index as module index.js<br/>(server/index.js)
    participant handlers as module handlers.js<br/>(server/socket/handlers.js)
    participant roomManager as module roomManager.js<br/>(server/utils/roomManager.js)
    participant Timer as module Timer.js<br/>(server/utils/Timer.js)

    Client->>index: connection event
    index->>handlers: new client connection
    handlers->>roomManager: add new player to room
    roomManager-->>handlers: playerAdded
    handlers-->>Client: player:joined(room)

    Client->>handlers: game:start
    handlers->>roomManager: start new game
    roomManager->>Timer: start round timer
    Timer-->>roomManager: timerStarted
    roomManager-->>handlers: gameStarted
    handlers-->>Client: game:started

    loop Every Game Action
        Client->>handlers: action:submit(actionData)
        handlers->>roomManager: process player action
        roomManager-->>handlers: actionProcessed
        handlers->>roomManager: get current game state
        roomManager-->>handlers: currentState
        handlers-->>Client: state:updated(newState)
    end

    Timer->>roomManager: round complete event
    roomManager->>handlers: broadcast final state
    handlers-->>Client: game:roundEnd(finalState)

    Client->>handlers: game:leave
    handlers->>roomManager: remove player from room
    roomManager-->>handlers: playerRemoved
    handlers-->>Client: player:left
    index->>handlers: handle disconnection
```

### Export Functions from roomManager.js

```mermaid
erDiagram
    ROOM_MANAGER_EXPORTS {
        function createRoom PK
        function getRoom PK
        function addPlayer PK
        function removePlayer PK
        function getRoomBySocketId PK
        function updateRoom PK
    }

    POKER_GAME_EXPORTS {
        function startGame PK
        function processAction PK
        function endGame PK
        function getActivePlayers PK
        function advancePhase PK
        function collectBets PK
        function awardPot PK
    }

    TIMER_EXPORTS {
        function startTimer PK
        function stopTimer PK
    }
```

## Client Socket Management

```mermaid
flowchart TB
    subgraph SocketContext
        A[Create Socket Instance] --> B[WebSocket connection]
        B --> C[Authenticate]
        C --> D[Socket Ready]
        
        E[Socket Instance] --> F[on event]
        F --> G[Update React State]
        G --> F
        
        H[emit event] --> I[Server Processing]
        I --> J[Receive Response]
        J --> G
    end
```

**Source Code:**

```javascript
// client/src/contexts/SocketContext.jsx
const socket = io(import.meta.env.VITE_SERVER_URL || '', {
  auth: {
    sessionToken,
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

// Connection lifecycle
socket.on('connect', () => {
  console.log('Connected to server');
  setConnected(true);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  setConnected(false);
});

// Game state listeners
socket.on('state:updated', (data) => {
  setGameState(data.room);
});

socket.on('game:started', (data) => {
  setGameState(data.room);
  setGameStatus('playing');
});

socket.on('player:joined', (data) => {
  setRoomId(data.room.roomId);
});

socket.on('error:message', (data) => {
  console.error('Error:', data.message);
  alert(data.message);
});

// Emit player actions
function submitAction(action, amount = 0) {
  socket.emit('game:action', { action, amount });
}

function joinRoom(playerName, stack, sessionToken) {
  socket.emit('game:join', { name: playerName, stack, sessionToken });
}