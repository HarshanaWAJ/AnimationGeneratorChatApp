const STATE_META = {
  // Actions
  jump:    { emoji: '🦘', color: 'badge-jump',    label: 'JUMP',     type: 'Action'  },
  run:     { emoji: '🏃', color: 'badge-run',     label: 'RUN',      type: 'Action'  },
  dance:   { emoji: '💃', color: 'badge-dance',   label: 'DANCE',    type: 'Action'  },
  spin:    { emoji: '🌀', color: 'badge-spin',    label: 'SPIN',     type: 'Action'  },
  wave:    { emoji: '✋', color: 'badge-wave',    label: 'WAVE',     type: 'Action'  },
  walk:    { emoji: '🚶', color: 'badge-walk',    label: 'WALK',     type: 'Action'  },
  float:   { emoji: '🛸', color: 'badge-float',   label: 'FLOAT',    type: 'Action'  },
  stretch: { emoji: '🤸', color: 'badge-stretch', label: 'STRETCH',  type: 'Action'  },
  // Emotions
  happy:   { emoji: '😊', color: 'badge-happy',   label: 'HAPPY',    type: 'Emotion' },
  sad:     { emoji: '😢', color: 'badge-sad',     label: 'SAD',      type: 'Emotion' },
  angry:   { emoji: '😡', color: 'badge-angry',   label: 'ANGRY',    type: 'Emotion' },
  excited: { emoji: '🤩', color: 'badge-excited', label: 'EXCITED',  type: 'Emotion' },
  scared:  { emoji: '😱', color: 'badge-scared',  label: 'SCARED',   type: 'Emotion' },
  surprised:{ emoji:'😲', color:'badge-surprised',label: 'SURPRISED',type: 'Emotion' },
  tired:   { emoji: '😴', color: 'badge-tired',   label: 'TIRED',    type: 'Emotion' },
  confused:{ emoji: '😵', color: 'badge-confused',label: 'CONFUSED', type: 'Emotion' },
  proud:   { emoji: '😎', color: 'badge-proud',   label: 'PROUD',    type: 'Emotion' },
  bored:   { emoji: '😑', color: 'badge-bored',   label: 'BORED',    type: 'Emotion' },
  love:    { emoji: '😍', color: 'badge-love',    label: 'LOVE',     type: 'Emotion' },
  nervous: { emoji: '😰', color: 'badge-nervous', label: 'NERVOUS',  type: 'Emotion' },
  celebrate:{ emoji:'🎉', color:'badge-celebrate',label:'CELEBRATE', type: 'Emotion' },
  cry:     { emoji: '😭', color: 'badge-cry',     label: 'CRY',      type: 'Emotion' },
  laugh:   { emoji: '😂', color: 'badge-laugh',   label: 'LAUGH',    type: 'Emotion' },
  think:   { emoji: '🤔', color: 'badge-think',   label: 'THINK',    type: 'Emotion' },
  panic:   { emoji: '😱', color: 'badge-panic',   label: 'PANIC',    type: 'Emotion' },
  meditate:{ emoji: '🧘', color: 'badge-meditate',label: 'MEDITATE', type: 'Emotion' },
  // Fallback
  idle:    { emoji: '🧍', color: 'badge-idle',    label: 'IDLE',     type: 'Action'  },
}

export default function ActionBadge({ action, confidence }) {
  const meta = STATE_META[action] || STATE_META.idle
  const pct  = Math.round((confidence ?? 0) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Type tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2,
          textTransform: 'uppercase', color: 'var(--text-muted)'
        }}>
          {meta.type} detected:
        </span>
      </div>

      {/* Badge pill */}
      <span className={`action-badge ${meta.color}`}>
        <span style={{ fontSize: 20 }}>{meta.emoji}</span>
        {meta.label}
      </span>

      {/* Confidence */}
      <div className="info-row">
        <span className="info-key">Confidence</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="info-val">{pct}%</span>
          {pct >= 80 && <span style={{ fontSize: 11, color: 'var(--cyan)' }}>● High</span>}
          {pct >= 50 && pct < 80 && <span style={{ fontSize: 11, color: 'var(--gold)' }}>● Medium</span>}
          {pct < 50 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>● Low</span>}
        </div>
        <div className="confidence-bar" style={{ marginTop: 4 }}>
          <div className="confidence-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
