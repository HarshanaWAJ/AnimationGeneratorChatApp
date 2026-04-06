# Antigravity Stick Figure Animator

A full-stack AI-powered animation system. Type any action text → get an 8-second 24fps GIF of a stick figure performing it in zero-gravity.

## Quick Start

### 1. Backend (FastAPI)
```powershell
# From project root (LLM2/)
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Project Structure
```
LLM2/
├── venv/                      ← Python virtual environment
├── backend/
│   ├── main.py                ← FastAPI app  (POST /api/animate)
│   ├── requirements.txt
│   ├── nlp/
│   │   └── classifier.py      ← spaCy action detector
│   └── animation/
│       ├── skeleton.py        ← 12-bone FK skeleton
│       ├── poses.py           ← Keyframes + antigravity physics
│       ├── renderer.py        ← Matplotlib frame renderer
│       └── gif_exporter.py    ← Pillow GIF assembler
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css          ← Design system
│   │   └── components/
│   │       ├── AnimatorPanel.jsx
│   │       ├── StickLoader.jsx
│   │       └── ActionBadge.jsx
│   ├── package.json
│   └── vite.config.js
└── test_pipeline.py           ← Smoke test (no server needed)
```

## Smoke Test (no server needed)
```powershell
.\venv\Scripts\python.exe test_pipeline.py
```

## Supported Actions
| Input keyword | Animation |
|---|---|
| jump / leap / hop | Jump with arms pumping |
| run / sprint / dash | Running in place |
| dance / groove | Expressive dance moves |
| spin / rotate / twirl | 360° spin |
| wave / hello / hi | Waving arm |
| walk / stroll / march | Walking cycle |
| float / fly / hover | Zero-G drift |
| stretch / yoga / reach | Arms wide stretch |
| anything else | Idle float |

## API
```
POST /api/animate
Content-Type: application/json

{ "action": "jumping high", "output_width": 500, "output_height": 500 }

→ Returns: image/gif binary
→ Headers: X-Action, X-Confidence, X-Frames
```
