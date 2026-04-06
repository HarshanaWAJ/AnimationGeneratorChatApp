/* Stick Figure SVG loader — pure CSS animated */
export default function StickLoader() {
  return (
    <div className="loading-wrapper">
      <svg
        className="stick-loader"
        viewBox="0 0 80 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head */}
        <circle
          cx="40" cy="18" r="12"
          stroke="#00e0ff" strokeWidth="2.5"
          fill="rgba(0,224,255,0.05)"
          style={{ animation: 'headBob 1.2s ease-in-out infinite' }}
        />
        {/* Torso */}
        <line x1="40" y1="30" x2="40" y2="72" stroke="#00e0ff" strokeWidth="2.5" strokeLinecap="round" />
        {/* Left Arm */}
        <line
          x1="40" y1="42" x2="22" y2="58"
          stroke="#00e0ff" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '40px 42px', animation: 'armSwingL 1.2s ease-in-out infinite' }}
        />
        <line
          x1="22" y1="58" x2="14" y2="72"
          stroke="#00e0ff" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '22px 58px', animation: 'armSwingL 1.2s ease-in-out infinite 0.1s' }}
        />
        {/* Right Arm */}
        <line
          x1="40" y1="42" x2="58" y2="58"
          stroke="#9b5de5" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '40px 42px', animation: 'armSwingR 1.2s ease-in-out infinite' }}
        />
        <line
          x1="58" y1="58" x2="66" y2="72"
          stroke="#9b5de5" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '58px 58px', animation: 'armSwingR 1.2s ease-in-out infinite 0.1s' }}
        />
        {/* Left Leg */}
        <line
          x1="40" y1="72" x2="28" y2="92"
          stroke="#00e0ff" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '40px 72px', animation: 'legSwingL 1.2s ease-in-out infinite' }}
        />
        <line
          x1="28" y1="92" x2="22" y2="110"
          stroke="#00e0ff" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '28px 92px', animation: 'legSwingL 1.2s ease-in-out infinite 0.1s' }}
        />
        {/* Right Leg */}
        <line
          x1="40" y1="72" x2="52" y2="92"
          stroke="#9b5de5" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '40px 72px', animation: 'legSwingR 1.2s ease-in-out infinite' }}
        />
        <line
          x1="52" y1="92" x2="58" y2="110"
          stroke="#9b5de5" strokeWidth="2.5" strokeLinecap="round"
          style={{ transformOrigin: '52px 92px', animation: 'legSwingR 1.2s ease-in-out infinite 0.1s' }}
        />
        {/* Joint dots */}
        {[[22,58],[58,58],[28,92],[52,92]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="white" stroke="#00e0ff" strokeWidth="1.5" />
        ))}
        {/* Glow trails */}
        {[[14,72],[66,72],[22,110],[58,110]].map(([x,y],i) => (
          <circle key={'t'+i} cx={x} cy={y} r="4" fill="#00e0ff" opacity="0.35"
            style={{ animation: `trailPulse 1.2s ease-in-out infinite ${i * 0.15}s` }}
          />
        ))}
      </svg>

      <style>{`
        @keyframes headBob {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes armSwingL {
          0%,100% { transform: rotate(0deg); }
          50%      { transform: rotate(-20deg); }
        }
        @keyframes armSwingR {
          0%,100% { transform: rotate(0deg); }
          50%      { transform: rotate(20deg); }
        }
        @keyframes legSwingL {
          0%,100% { transform: rotate(0deg); }
          50%      { transform: rotate(15deg); }
        }
        @keyframes legSwingR {
          0%,100% { transform: rotate(0deg); }
          50%      { transform: rotate(-15deg); }
        }
        @keyframes trailPulse {
          0%,100% { opacity: 0.15; r: 3px; }
          50%      { opacity: 0.55; r: 6px; }
        }
      `}</style>

      <div className="loading-text">
        Generating animation<span className="loading-dots" />
      </div>
      <div className="progress-bar">
        <div className="progress-fill" />
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>
        Rendering 192 frames · 24 fps · 8 sec loop
      </p>
    </div>
  )
}
