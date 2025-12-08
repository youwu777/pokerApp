# Poker with M8s

A private Texas Hold'em poker home game application built with Node.js and React. Play with friends in real-time with no registration required.

## Features

- 🎮 **Private Rooms**: Create and share room links with friends
- 🃏 **Texas Hold'em**: Full poker game with blinds, betting rounds, and showdowns
- ⚡ **Real-time**: WebSocket-based gameplay with instant updates
- 🎯 **Run It Twice**: Deal the board twice when all-in
- 🐰 **Rabbit Hunt**: See what cards would have come after hand ends
- ⏱️ **Timer System**: Action timer with time bank support
- 💬 **In-game Chat**: Communicate with emotes and messages
- 📱 **Responsive**: Works on desktop, tablet, and mobile

## Tech Stack

**Backend:**
- Node.js with Express
- Socket.io for WebSocket communication
- pokersolver for hand evaluation

**Frontend:**
- React with Vite
- Socket.io-client
- Vanilla CSS with modern design

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory

2. Install dependencies:
```bash
npm install
```

This will install dependencies for both the server and client.

### Running the Application

#### Development Mode (Recommended)

Run both server and client concurrently:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:5173`

#### Run Separately

**Server only:**
```bash
npm run dev:server
```

**Client only:**
```bash
npm run dev:client
```

### Usage

1. Open `http://localhost:5173` in your browser
2. Click "New Game" to create a room with custom settings
3. Share the room URL with friends
4. Players join, sit at seats, and start playing!

## Game Controls

### Host Controls
- **Start Game / Next Hand**: Begin a new hand
- **Pause**: Freeze the game between hands
- **Settings**: Update game configuration

### Player Actions
- **Fold**: Give up your hand
- **Check**: Pass action (when no bet to call)
- **Call**: Match the current bet
- **Bet/Raise**: Increase the bet (use slider for amount)
- **All In**: Bet all remaining chips

## Configuration Options

- **Blinds**: Small and big blind amounts
- **Starting Stack**: Chips each player starts with
- **Action Timer**: Time limit per action (15/30/60 seconds)
- **Time Bank**: Extra time reserve for tough decisions
- **Run It Twice**: Enable/disable RIT for all-in situations
- **Rabbit Hunt**: Allow seeing undealt cards
- **Hand Limit**: Set session length (unlimited by default)

## Project Structure

```
poker_with_m8/
├── server/              # Backend
│   ├── engine/          # Poker game logic
│   ├── models/          # Room and Player models
│   ├── socket/          # WebSocket handlers
│   ├── utils/           # Timer and room manager
│   └── index.js         # Server entry point
├── client/              # Frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── context/     # Socket context
│   │   ├── utils/       # Helper functions
│   │   ├── App.jsx      # Main app
│   │   └── index.css    # Global styles
│   └── index.html
└── package.json         # Root workspace config
```

## Notes

- This is a play-money game for entertainment only
- No real money, rake, or cashier functionality
- Rooms are stored in memory and will be cleared on server restart
- For production use, consider adding Redis or database persistence

## Deployment

### Frontend (GitHub Pages)

The frontend is configured to deploy automatically to GitHub Pages via GitHub Actions.

1. **Enable GitHub Pages** in your repository settings:
   - Go to Settings → Pages
   - Source: GitHub Actions

2. **Set Backend URL** (optional):
   - If your backend is deployed elsewhere, add a secret:
     - Go to Settings → Secrets and variables → Actions
     - Add secret: `VITE_SERVER_URL` with your backend URL
   - If not set, defaults to `http://localhost:3001`

3. **Deploy**:
   - Push to `main` branch to trigger automatic deployment
   - Or manually trigger via Actions tab → "Deploy to GitHub Pages"

The site will be available at: `https://youwu777.github.io/pokerApp/`

### Backend

The backend needs to be deployed separately (e.g., Heroku, Railway, Render, etc.) and the frontend URL updated accordingly.

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
