import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { SocketProvider } from './context/SocketContext'
import Lobby from './components/Lobby'
import PokerRoom from './components/PokerRoom'

function App() {
    return (
        <SocketProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Lobby />} />
                    <Route path="/room/:roomId" element={<PokerRoom />} />
                </Routes>
            </Router>
        </SocketProvider>
    )
}

export default App
