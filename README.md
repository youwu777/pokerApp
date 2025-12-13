# Honest Poker

A private Texas Hold'em poker home game application built with Node.js and React. Play with friends in real-time with no registration required.

**🎮 Live Site:** [https://honest-poker.win/](https://honest-poker.win/)

## Features

- 🎮 **Private Rooms**: Create and share room links with friends
- 🃏 **Texas Hold'em**: Full poker game with blinds, betting rounds, and showdowns
- ⚡ **Real-time**: WebSocket-based gameplay with instant updates
- 🎯 **Run It Twice**: Deal the board twice when all-in scenarios
- 🐰 **Rabbit Hunt**: See what cards would have come after hand ends early
- ⏱️ **Timer System**: Configurable action timer with time bank support
- 💬 **In-game Chat**: Communicate with friends using emotes and messages
- 🎨 **Smooth Animations**: Chip movements and visual feedback
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile
- 🔒 **Rate Limiting**: Built-in protection against abuse

## Tech Stack

**Backend:**
- Node.js with Express
- Socket.io for real-time WebSocket communication
- pokersolver for accurate hand evaluation
- express-rate-limit for API protection

**Frontend:**
- React 18 with Vite
- React Router for navigation
- Socket.io-client for real-time updates
- Modern CSS with animations

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

**For local development:**
1. Open `http://localhost:5173` in your browser

**For production:**
1. Visit [https://honest-poker.win/](https://honest-poker.win/)

**To play:**
1. Click "New Game" to create a room
2. Configure game settings (blinds, starting stack, timers, etc.)
3. Share the room URL with friends
4. Players join, sit at available seats, and start playing!

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
- **Action Timer**: Time limit per action (15/30/60 seconds, or off)
- **Time Bank**: Extra time reserve for critical decisions
- **Run It Twice**: Enable/disable running it twice for all-in situations
- **Rabbit Hunt**: Allow players to reveal undealt community cards
- **Hand Limit**: Set maximum hands per session (unlimited by default)

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

## Important Notes

- This is a **play-money game** for entertainment only
- No real money, rake, or cashier functionality
- Rooms are stored in memory (cleared on server restart)
- For production deployment, consider:
  - Adding Redis or database for room persistence
  - Implementing user authentication
  - Setting up SSL/TLS certificates
  - Configuring environment variables for production URLs

## Deployment

### Frontend (GitHub Pages / Static Hosting)

The frontend can be deployed to any static hosting service (GitHub Pages, Netlify, Vercel, etc.)

**For GitHub Pages:**
1. Enable GitHub Pages in repository settings:
   - Settings → Pages → Source: GitHub Actions
2. Set backend URL as environment variable:
   - Settings → Secrets and variables → Actions
   - Add `VITE_SERVER_URL` secret with your backend URL
3. Push to `main` branch to trigger automatic deployment

**Build for production:**
```bash
cd client
npm run build
```

### Backend (Node.js Hosting)

Deploy the backend to any Node.js hosting service:
- **Recommended**: Railway, Render, Fly.io, DigitalOcean
- **Legacy**: Heroku

**Environment setup:**
- Set `NODE_ENV=production`
- Configure CORS to allow your frontend domain
- Ensure trust proxy is enabled for rate limiting behind reverse proxies

**Start command:**
```bash
npm start --workspace=server
```

## License

MIT

## Contributing

Feel free to submit issues and pull requests!
