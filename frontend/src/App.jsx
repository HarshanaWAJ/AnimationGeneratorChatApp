import AnimatorPanel from './components/AnimatorPanel'
import './index.css'

export default function App() {
  return (
    <div className="app-root">
      {/* Animated deep-space background */}
      <div className="bg-stars" aria-hidden="true" />

      {/* Header */}
      <header className="app-header">
        <span className="header-badge">✦ AI-Powered · Physics-Simulated · Zero-G</span>
        <h1 className="header-title">JH Software Solutions Animator</h1>
        <p className="header-sub">
          Type any action. Watch your stick figure lift off, defy gravity,
          and perform it in zero-G — complete with glow trails &amp; speech bubble.
        </p>
      </header>

      {/* Main */}
      <main style={{ width: '100%' }}>
        <AnimatorPanel />
      </main>

      {/* Footer */}
      <footer className="app-footer">
        Built with FastAPI · spaCy · Matplotlib · React ·{' '}
        <span style={{ color: 'var(--cyan)', opacity: 0.7 }}>192 frames @ 24fps</span>
      </footer>
    </div>
  )
}
