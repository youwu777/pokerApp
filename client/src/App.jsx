import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import Lobby from './components/Lobby'
import PokerRoom from './components/PokerRoom'

function App() {
    return (
        <SocketProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Lobby />} />
                    {/* Redirect incomplete room URLs back home */}
                    <Route path="/room" element={<Navigate to="/" replace />} />
                    <Route path="/room/" element={<Navigate to="/" replace />} />
                    <Route path="/room/:roomId" element={<PokerRoom />} />
                    {/* Catch-all: send any unknown path to Lobby */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </SocketProvider>
    )
}

export default App
