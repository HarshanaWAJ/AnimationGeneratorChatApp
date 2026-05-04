import { useState, useRef, useCallback, useEffect } from 'react'
import StickLoader from './StickLoader'
import ActionBadge from './ActionBadge'
import { encodeWAV } from '../utils/audioUtils'

const ACTION_GROUPS = [
  {
    label: 'Actions',
    items: [
      { label: '🦘 Jump',    text: 'jumping high' },
      { label: '🏃 Run',     text: 'running fast' },
      { label: '💃 Dance',   text: 'dancing wildly' },
      { label: '🌀 Spin',    text: 'spinning around' },
      { label: '✋ Wave',    text: 'waving hello' },
      { label: '🚶 Walk',    text: 'walking slowly' },
      { label: '🛸 Float',   text: 'floating in zero gravity' },
      { label: '🤸 Stretch', text: 'stretching arms wide' },
    ]
  },
  {
    label: 'Emotions',
    items: [
      { label: '😊 Happy',    text: 'feeling so happy' },
      { label: '😢 Sad',      text: 'feeling sad' },
      { label: '😡 Angry',    text: 'I am furious' },
      { label: '🤩 Excited',  text: 'so excited!' },
      { label: '😱 Scared',   text: 'terrified!' },
      { label: '😲 Surprised',text: 'OMG I am surprised' },
      { label: '😴 Tired',    text: 'exhausted and tired' },
      { label: '😵 Confused', text: 'so confused' },
      { label: '😎 Proud',    text: 'feeling proud' },
      { label: '😑 Bored',    text: 'this is boring' },
      { label: '😍 Love',     text: 'I love you' },
      { label: '😰 Nervous',  text: 'really nervous' },
      { label: '🎉 Celebrate',text: 'let us celebrate!' },
      { label: '😭 Cry',      text: 'I want to cry' },
      { label: '😂 Laugh',    text: 'cannot stop laughing' },
      { label: '🤔 Think',    text: 'thinking deeply' },
      { label: '🏃 Panic',    text: 'absolute panic' },
      { label: '🧘 Meditate', text: 'let us meditate' },
    ]
  }
]

export default function AnimatorPanel() {
  const [inputText, setInputText]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [gifUrl, setGifUrl]           = useState(null)
  const [gifBlob, setGifBlob]         = useState(null)
  const [action, setAction]           = useState(null)
  const [confidence, setConfidence]   = useState(null)
  const [displayText, setDisplayText] = useState('')
  const [error, setError]             = useState(null)
  const [frames, setFrames]           = useState(null)
  const [activeGroup, setActiveGroup] = useState('Actions')

  // Voice States
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])

  const inputRef = useRef(null)

  // ── Voice Recording Logic ────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!isRecording) return
    setIsRecording(false)

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    const samples = new Float32Array(audioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0))
    let offset = 0
    for (const chunk of audioChunksRef.current) {
      samples.set(chunk, offset)
      offset += chunk.length
    }
    audioChunksRef.current = []

    const wavBlob = encodeWAV(samples, audioContextRef.current.sampleRate)
    handleVoiceUpload(wavBlob)
  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      
      processorRef.current = processor
      audioChunksRef.current = []

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        audioChunksRef.current.push(new Float32Array(inputData))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      
      setIsRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const handleVoiceInput = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleVoiceUpload = async (blob) => {
    setIsTranscribing(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', blob, 'voice.wav')

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Transcription failed')

      const data = await res.json()
      if (data.text) {
        setInputText(data.text)
        handleGenerate(data.text)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to transcribe voice: ' + err.message)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleSpeak = (textToSay) => {
    if (!window.speechSynthesis) return
    
    // Stop any current speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(textToSay || displayText)
    utterance.rate = 0.95
    utterance.pitch = 1.1 // Slightly higher pitch for "stick figure" feel
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  const handleGenerate = useCallback(async (text) => {
    const raw = (text || inputText).trim()
    if (!raw) { inputRef.current?.focus(); return }

    if (gifUrl) URL.revokeObjectURL(gifUrl)
    setGifUrl(null); setGifBlob(null); setError(null)
    setAction(null); setLoading(true); setDisplayText(raw)

    try {
      const res = await fetch('/api/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: raw, output_width: 500, output_height: 500 }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Server error ${res.status}`)
      }

      const detectedAction = res.headers.get('X-Action') || 'idle'
      const conf           = parseFloat(res.headers.get('X-Confidence') || '0')
      const frameCount     = parseInt(res.headers.get('X-Frames') || '192')

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)

      setGifUrl(url); setGifBlob(blob)
      setAction(detectedAction); setConfidence(conf); setFrames(frameCount)
      
      // Auto-speak the response
      handleSpeak(raw)

    } catch (err) {
      setError(err.message || 'Failed to generate animation')
    } finally {
      setLoading(false)
    }
  }, [inputText, gifUrl])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleGenerate()
  }

  const handleQuick = (text) => {
    setInputText(text)
    handleGenerate(text)
  }

  const handleDownload = () => {
    if (!gifBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(gifBlob)
    a.download = `antigravity_${action || 'animation'}.gif`
    a.click()
  }

  const currentGroup = ACTION_GROUPS.find(g => g.label === activeGroup)

  return (
    <div className="main-panel">

      {/* ── Input Card ─────────────────────────────────────────────────── */}
      <div className="glass-card">
        <div className="input-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="input-label">✦ What should the figure do or feel?</span>
            {isRecording && (
              <div className="recording-hint">
                <div className="visualizer-mini">
                  <div className="vis-bar"></div>
                  <div className="vis-bar"></div>
                  <div className="vis-bar"></div>
                </div>
                Listening...
              </div>
            )}
            {isTranscribing && (
              <div className="recording-hint" style={{ color: 'var(--magenta)' }}>
                Processing voice...
              </div>
            )}
          </div>

          <div className="input-row">
            <button 
              className={`btn-mic ${isRecording ? 'is-recording' : ''} ${isTranscribing ? 'is-loading' : ''}`}
              onClick={handleVoiceInput}
              title="Voice Input"
              disabled={loading || isTranscribing}
            >
              {isRecording ? '⏹' : isTranscribing ? '⌛' : '🎤'}
            </button>
            <input
              ref={inputRef}
              id="action-input"
              className="action-input"
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "jumping", "I feel so happy", "terrified!"…'
              disabled={loading}
              autoComplete="off"
              maxLength={120}
            />
            <button
              id="btn-generate"
              className="btn-generate"
              onClick={() => handleGenerate()}
              disabled={loading || !inputText.trim()}
            >
              <span className="btn-text">
                {loading ? '⏳ Rendering…' : '✦ Animate'}
              </span>
            </button>
          </div>

          {/* Group tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="quick-label">Try:</span>
            {ACTION_GROUPS.map(g => (
              <button
                key={g.label}
                className="pill"
                onClick={() => setActiveGroup(g.label)}
                style={activeGroup === g.label ? {
                  borderColor: 'var(--cyan)',
                  color: 'var(--cyan)',
                  background: 'rgba(0,224,255,0.10)'
                } : {}}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Quick action pills */}
          <div className="quick-actions" style={{ maxHeight: 80, overflowY: 'auto' }}>
            {currentGroup?.items.map(({ label, text }) => (
              <button
                key={text}
                className="pill"
                onClick={() => handleQuick(text)}
                disabled={loading}
                id={`quick-${text.replace(/\s+/g, '-').slice(0, 30)}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Result Card ────────────────────────────────────────────────── */}
      <div className="glass-card">
        {error && (
          <div className="error-msg">
            <span>⚠️</span> {error}
          </div>
        )}

        {loading && <StickLoader />}

        {!loading && gifUrl && (
          <div className="result-section">
            {/* GIF */}
            <div className="animation-frame">
              <div className="animation-frame-inner" id="animation-display">
                <img
                  id="result-gif"
                  className="animation-gif"
                  src={gifUrl}
                  alt={`Stick figure ${action} animation`}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                {action && <ActionBadge action={action} confidence={confidence} />}
                <button 
                  className={`btn-speaker ${isSpeaking ? 'is-playing' : ''}`}
                  onClick={() => handleSpeak()}
                  title="Play Voice"
                >
                  {isSpeaking ? '🔊' : '🔈'}
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="info-panel glass-card" style={{ padding: 20 }}>
              <div className="info-row">
                <span className="info-key">Your Prompt</span>
                <span className="info-val" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  "{displayText}"
                </span>
              </div>
              <div className="info-row">
                <span className="info-key">Duration</span>
                <span className="info-val highlight">8 seconds</span>
              </div>
              <div className="info-row">
                <span className="info-key">Frame Rate</span>
                <span className="info-val highlight">24 fps</span>
              </div>
              <div className="info-row">
                <span className="info-key">Total Frames</span>
                <span className="info-val">{frames ?? 192}</span>
              </div>
              <div className="info-row">
                <span className="info-key">Speech Status</span>
                <span className="info-val" style={{ fontSize: 12, color: 'var(--cyan)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isSpeaking ? 'Now speaking...' : 'Ready to voice'}
                  {isSpeaking && (
                    <div className="visualizer-mini">
                      <div className="vis-bar"></div>
                      <div className="vis-bar"></div>
                      <div className="vis-bar"></div>
                    </div>
                  )}
                </span>
              </div>
              
              <button id="btn-download" className="btn-download" onClick={handleDownload} style={{ marginTop: 8 }}>
                ⬇ Download GIF
              </button>
            </div>
          </div>
        )}

        {!loading && !gifUrl && !error && (
          <div className="empty-state">
            <span className="empty-icon">🕺</span>
            <h2 className="empty-title">Zero-G Awaits</h2>
            <p className="empty-sub">
              Type or <strong>Speak</strong> any action —
              watch your stick figure defy gravity performing it with full physics.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['😊 Happy','😡 Angry','🎉 Celebrate','🤔 Think','💃 Dance','😱 Scared'].map(e => (
                <span key={e} style={{ fontSize: 13, padding: '4px 12px', borderRadius: 99,
                  border: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>{e}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
