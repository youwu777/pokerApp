// Sound effects using Web Audio API
import coinSpillSound from '../components/sound/coin-spill-105867.mp3'
import allInPushChipsSound from '../components/sound/allinpushchips-96121.mp3'
import checkSound from '../components/sound/check.mp3'

class SoundManager {
    constructor() {
        this.audioContext = null
        this.enabled = true
        this.initAudioContext()
        // Preload audio files
        this.audioFiles = {}
        this.preloadAudio()
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
        } catch (e) {
            console.warn('Web Audio API not supported:', e)
            this.enabled = false
        }
    }

    // Preload audio files
    preloadAudio() {
        try {
            // Preload coin collect sound
            const coinSound = new Audio(coinSpillSound)
            coinSound.preload = 'auto'
            this.audioFiles['coinCollect'] = coinSound

            // Preload all-in push chips sound
            const allInSound = new Audio(allInPushChipsSound)
            allInSound.preload = 'auto'
            this.audioFiles['allInPushChips'] = allInSound

            // Preload check sound
            const checkAudio = new Audio(checkSound)
            checkAudio.preload = 'auto'
            this.audioFiles['check'] = checkAudio
        } catch (e) {
            console.warn('Failed to preload audio files:', e)
        }
    }

    // Ensure audio context is resumed (required for user interaction)
    async ensureContext() {
        if (!this.audioContext) {
            this.initAudioContext()
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
        }
    }

    // Generate a tone
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            const oscillator = this.audioContext.createOscillator()
            const gainNode = this.audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(this.audioContext.destination)

            oscillator.frequency.value = frequency
            oscillator.type = type

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

            oscillator.start(this.audioContext.currentTime)
            oscillator.stop(this.audioContext.currentTime + duration)
        })
    }

    // Play a sequence of tones (chord)
    playChord(frequencies, duration, type = 'sine', volume = 0.2) {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    this.playTone(freq, duration, type, volume)
                }, index * 20)
            })
        })
    }

    // Your turn sound - pleasant notification
    playYourTurn() {
        this.playChord([523.25, 659.25, 783.99], 0.3, 'sine', 0.25) // C-E-G chord
    }

    // Ticking sound - clock tick for countdown
    playTick() {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            const duration = 0.08 // Short, sharp tick
            const oscillator = this.audioContext.createOscillator()
            const gainNode = this.audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(this.audioContext.destination)

            // High-pitched tick sound
            oscillator.frequency.value = 1000 // High frequency for a sharp tick
            oscillator.type = 'sine'

            // Quick attack and decay for a sharp tick sound
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.005)
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

            oscillator.start(this.audioContext.currentTime)
            oscillator.stop(this.audioContext.currentTime + duration)
        })
    }

    // Check sound - play MP3 file
    playCheck() {
        if (!this.enabled) return

        try {
            const checkAudio = this.audioFiles['check']
            if (checkAudio) {
                // Clone and play to allow overlapping sounds
                const audio = checkAudio.cloneNode()
                audio.volume = 0.5
                audio.play().catch(e => {
                    console.warn('Failed to play check sound:', e)
                })
            } else {
                // Fallback: try to load on demand if preload failed
                const audio = new Audio(checkSound)
                audio.volume = 0.5
                audio.play().catch(e => {
                    console.warn('Failed to play check sound:', e)
                })
            }
        } catch (e) {
            console.warn('Error playing check sound:', e)
        }
    }

    // Call/Raise sound - play MP3 file
    playCallRaise() {
        if (!this.enabled) return

        try {
            const allInSound = this.audioFiles['allInPushChips']
            if (allInSound) {
                // Clone and play to allow overlapping sounds
                const audio = allInSound.cloneNode()
                audio.volume = 0.5
                audio.play().catch(e => {
                    console.warn('Failed to play all-in push chips sound:', e)
                })
            } else {
                // Fallback: try to load on demand if preload failed
                const audio = new Audio(allInPushChipsSound)
                audio.volume = 0.5
                audio.play().catch(e => {
                    console.warn('Failed to play all-in push chips sound:', e)
                })
            }
        } catch (e) {
            console.warn('Error playing all-in push chips sound:', e)
        }
    }

    // Fold/Timeout sound - sad, descending tone
    playFoldTimeout() {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            const duration = 0.6 // Longer, more melancholic
            const oscillator = this.audioContext.createOscillator()
            const gainNode = this.audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(this.audioContext.destination)

            // Start at a low note and descend even lower (sad, falling effect)
            oscillator.type = 'sine' // Sine for smoother, more melancholic sound
            oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime) // Low A
            oscillator.frequency.exponentialRampToValueAtTime(165, this.audioContext.currentTime + duration) // Descend to low E (sad interval)

            // Slow fade out for melancholic effect
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.05)
            gainNode.gain.linearRampToValueAtTime(0.25, this.audioContext.currentTime + duration * 0.3)
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

            oscillator.start(this.audioContext.currentTime)
            oscillator.stop(this.audioContext.currentTime + duration)
        })
    }

    // Throw item sound - whoosh/throw effect
    playThrowItem() {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            // Create a whoosh sound using noise and frequency sweep
            const duration = 3 // Longer duration
            const oscillator = this.audioContext.createOscillator()
            const gainNode = this.audioContext.createGain()
            const filter = this.audioContext.createBiquadFilter()

            oscillator.connect(filter)
            filter.connect(gainNode)
            gainNode.connect(this.audioContext.destination)

            // Use a sawtooth wave for a more whoosh-like sound
            oscillator.type = 'sawtooth'
            
            // Sweep frequency from high to low (like something flying through air)
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
            oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + duration)

            // Add a low-pass filter that opens up and closes (whoosh effect)
            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(200, this.audioContext.currentTime)
            filter.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + duration * 0.3)
            filter.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + duration)

            // Volume envelope - quick attack, longer decay
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.02)
            gainNode.gain.exponentialRampToValueAtTime(0.15, this.audioContext.currentTime + duration * 0.4)
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)

            oscillator.start(this.audioContext.currentTime)
            oscillator.stop(this.audioContext.currentTime + duration)

            // Play impact sound after throw sound ends
            setTimeout(() => {
                this.playItemImpact()
            }, duration * 1000) // Convert to milliseconds
        })
    }

    // Item impact sound - egg hitting ground (layered synthesis)
    playItemImpact() {
        if (!this.enabled || !this.audioContext) return

        this.ensureContext().then(() => {
            const now = this.audioContext.currentTime

            // 1. Impact "thump" - Sine wave with pitch drop
            const thumpOsc = this.audioContext.createOscillator()
            const thumpGain = this.audioContext.createGain()
            thumpOsc.type = 'sine'
            thumpOsc.frequency.setValueAtTime(150, now)
            thumpOsc.frequency.exponentialRampToValueAtTime(80, now + 0.05) // Pitch drop over 50ms
            
            thumpGain.gain.setValueAtTime(0, now)
            thumpGain.gain.linearRampToValueAtTime(0.3, now + 0.001) // Attack 0ms (instant)
            thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08) // Decay 80ms
            
            thumpOsc.connect(thumpGain)
            thumpGain.connect(this.audioContext.destination)
            thumpOsc.start(now)
            thumpOsc.stop(now + 0.08)

            // 2. Squish / splat - Noise with low-pass filter
            const bufferSize = this.audioContext.sampleRate * 0.05 // 50ms buffer
            const noiseBuffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate)
            const noiseData = noiseBuffer.getChannelData(0)
            
            // Generate white noise
            for (let i = 0; i < bufferSize; i++) {
                noiseData[i] = Math.random() * 2 - 1
            }
            
            const noiseSource = this.audioContext.createBufferSource()
            noiseSource.buffer = noiseBuffer
            noiseSource.loop = false
            
            const noiseFilter = this.audioContext.createBiquadFilter()
            noiseFilter.type = 'lowpass'
            noiseFilter.frequency.value = 1200 // Low-pass around 1200 Hz
            
            const noiseGain = this.audioContext.createGain()
            noiseGain.gain.setValueAtTime(0, now)
            noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.005) // Super short attack
            noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03) // Fast decay 30ms
            
            noiseSource.connect(noiseFilter)
            noiseFilter.connect(noiseGain)
            noiseGain.connect(this.audioContext.destination)
            noiseSource.start(now)
            noiseSource.stop(now + 0.03)

            // 3. Body of the squash - Triangle oscillator
            const bodyOsc = this.audioContext.createOscillator()
            const bodyGain = this.audioContext.createGain()
            bodyOsc.type = 'triangle'
            bodyOsc.frequency.value = 60 // ~60 Hz
            
            bodyGain.gain.setValueAtTime(0, now)
            bodyGain.gain.linearRampToValueAtTime(0.2, now + 0.01)
            bodyGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15) // Fast decay 150ms
            
            bodyOsc.connect(bodyGain)
            bodyGain.connect(this.audioContext.destination)
            bodyOsc.start(now)
            bodyOsc.stop(now + 0.15)
        })
    }

    // Gold collect sound - play MP3 file
    playGoldCollect() {
        if (!this.enabled) return

        try {
            const coinSound = this.audioFiles['coinCollect']
            if (coinSound) {
                // Clone and play to allow overlapping sounds
                const audio = coinSound.cloneNode()
                audio.volume = 0.4
                audio.play().catch(e => {
                    console.warn('Failed to play coin collect sound:', e)
                })
            } else {
                // Fallback: try to load on demand if preload failed
                const audio = new Audio(coinSpillSound)
                audio.volume = 0.4
                audio.play().catch(e => {
                    console.warn('Failed to play coin collect sound:', e)
                })
            }
        } catch (e) {
            console.warn('Error playing coin collect sound:', e)
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled
    }
}

// Singleton instance
const soundManager = new SoundManager()

export default soundManager

