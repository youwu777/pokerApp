import { useState } from 'react'
import './GameSettings.css'

export default function GameSettings({ onClose, onSubmit }) {
    const [settings, setSettings] = useState({
        smallBlind: 10,
        bigBlind: 20,
        actionTimer: 15,
        timeBank: 10,
        allowRunItTwice: true,
        allowRabbitHunt: true,
        handLimit: null
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(settings)
    }

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Game Settings</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="settings-form">
                    <div className="settings-section">
                        <h3>Blinds</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Small Blind</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={settings.smallBlind}
                                    onChange={(e) => updateSetting('smallBlind', parseInt(e.target.value))}
                                    min="1"
                                />
                            </div>
                            <div className="form-group">
                                <label>Big Blind</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={settings.bigBlind}
                                    onChange={(e) => updateSetting('bigBlind', parseInt(e.target.value))}
                                    min="1"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Timer Settings</h3>
                        <div className="form-group">
                            <label>Action Timer (seconds)</label>
                            <select
                                className="input"
                                value={settings.actionTimer}
                                onChange={(e) => updateSetting('actionTimer', parseInt(e.target.value))}
                            >
                                <option value="15">15 seconds</option>
                                <option value="30">30 seconds</option>
                                <option value="60">60 seconds</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Time Bank (seconds)</label>
                            <input
                                type="number"
                                className="input"
                                value={settings.timeBank}
                                onChange={(e) => updateSetting('timeBank', parseInt(e.target.value))}
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Game Features</h3>
                        <div className="checkbox-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.allowRunItTwice}
                                    onChange={(e) => updateSetting('allowRunItTwice', e.target.checked)}
                                />
                                <span>Allow Run It Twice</span>
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.allowRabbitHunt}
                                    onChange={(e) => updateSetting('allowRabbitHunt', e.target.checked)}
                                />
                                <span>Allow Rabbit Hunt</span>
                            </label>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Session Length</h3>
                        <div className="form-group">
                            <label>Hand Limit (leave empty for unlimited)</label>
                            <input
                                type="number"
                                className="input"
                                value={settings.handLimit || ''}
                                onChange={(e) => updateSetting('handLimit', e.target.value ? parseInt(e.target.value) : null)}
                                min="1"
                                placeholder="Unlimited"
                            />
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Create Game
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
