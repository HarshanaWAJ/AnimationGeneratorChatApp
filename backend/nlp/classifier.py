"""
NLP Action + Emotion Classifier
Maps user text → animation state (actions AND emotions).
Uses spaCy lemmatization + multi-tier keyword matching.
Falls back to 'idle' for nonsensical / abstract prompts.

Supported states (18 total):
  ACTIONS: jump, run, dance, spin, wave, walk, float, stretch
  EMOTIONS: happy, sad, angry, excited, scared, surprised,
            tired, confused, proud, bored, love, nervous,
            celebrate, cry, laugh, think, panic, meditate
  FALLBACK: idle
"""
import re
import spacy
from typing import Tuple

# Load spaCy model once at module level
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess, sys
    subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
    nlp = spacy.load("en_core_web_sm")

# ─── Keyword Map (action + emotion states) ──────────────────────────────────
# Order matters: more-specific entries take priority over general ones

KEYWORD_MAP: dict[str, list[str]] = {
    # ── Physical Actions ──────────────────────────────────────────────────────
    "jump": [
        "jump", "jumping", "leap", "leaping", "hop", "hopping",
        "bounce", "bouncing", "spring", "vault", "lunge",
    ],
    "run": [
        "run", "running", "sprint", "sprinting", "dash", "dashing",
        "jog", "jogging", "race", "rush", "gallop", "hurry",
        "charge", "bolt", "flee", "escape",
    ],
    "dance": [
        "dance", "dancing", "groove", "grooving", "boogie",
        "sway", "swaying", "twirl", "twirling", "shimmy",
        "twerk", "step", "shuffle", "breakdance", "waltz",
    ],
    "spin": [
        "spin", "spinning", "rotate", "rotating", "whirl", "whirling",
        "turn", "turning", "pirouette", "revolve", "gyrate",
    ],
    "wave": [
        "wave", "waving", "greet", "greeting", "hello", "hi",
        "bye", "farewell", "signal", "beckon",
    ],
    "walk": [
        "walk", "walking", "stroll", "strolling", "march", "marching",
        "stride", "pace", "wander", "roam", "saunter", "tiptoe",
        "go", "going", "come", "coming", "move", "moving", "travel", "traveling",
    ],
    "float": [
        "float", "floating", "drift", "drifting", "glide", "gliding",
        "hover", "hovering", "fly", "flying", "soar", "levitate",
        "weightless", "antigravity", "zero-g", "zero gravity",
    ],
    "stretch": [
        "stretch", "stretching", "reach", "reaching", "extend", "extending",
        "yoga", "pose", "flex", "flexing", "limbering",
    ],

    # ── Emotions → mapped to unique animation states ──────────────────────────
    "happy": [
        "happy", "happiness", "joyful", "joy", "cheerful", "cheery",
        "glad", "delighted", "pleased", "elated", "blissful",
        "content", "gleeful", "merry", "jolly", "upbeat",
        "ecstatic", "thrilled", "overjoyed",
    ],
    "sad": [
        "sad", "sadness", "unhappy", "sorrowful", "sorrow", "gloomy",
        "depressed", "depression", "melancholy", "heartbroken",
        "miserable", "down", "dejected", "downcast", "upset",
        "grief", "grieving", "mourning", "blue", "despair",
    ],
    "angry": [
        "angry", "anger", "mad", "furious", "fury", "rage", "raging",
        "enraged", "irate", "livid", "outraged", "irritated",
        "frustrated", "frustration", "annoyed", "aggressive",
        "hostile", "wrathful", "infuriated",
    ],
    "excited": [
        "excited", "excitement", "enthusiastic", "enthusiasm",
        "hyper", "pumped", "stoked", "amped", "fired up",
        "eager", "energized", "exhilarated", "buzzing", "wired",
    ],
    "scared": [
        "scared", "fear", "fearful", "afraid", "terrified",
        "terror", "frightened", "fright", "horrified", "horror",
        "anxious", "anxiety", "petrified", "trembling", "cowering",
        "shaking", "spooked", "dread",
    ],
    "surprised": [
        "surprised", "surprise", "shocked", "shock", "astonished",
        "astonishment", "amazed", "amazement", "startled",
        "stunned", "astounded", "wide-eyed", "jaw drop", "woah", "whoa",
    ],
    "tired": [
        "tired", "tiredness", "exhausted", "exhaustion", "sleepy",
        "drowsy", "weary", "fatigued", "fatigue", "drained",
        "worn out", "sluggish", "lethargic", "yawning", "limp",
    ],
    "confused": [
        "confused", "confusion", "puzzled", "puzzle", "perplexed",
        "baffled", "bewildered", "bewilderment", "lost",
        "uncertain", "unsure", "dazed", "disoriented", "questioning",
        "wondering", "scratching head",
    ],
    "proud": [
        "proud", "pride", "confident", "confidence", "triumphant",
        "triumph", "victorious", "victory", "accomplished",
        "achievement", "arrogant", "boastful", "smug", "superior",
    ],
    "bored": [
        "bored", "boredom", "boring", "dull", "monotonous",
        "uninterested", "indifferent", "apathetic", "meh",
        "tedious", "listless", "disengaged",
    ],
    "love": [
        "love", "loving", "lovey", "romantic", "romance", "affection",
        "affectionate", "adore", "adoration", "crush", "smitten",
        "infatuated", "heart", "hearts", "heartfelt", "tender",
        "flirty", "flirt", "charmed",
    ],
    "nervous": [
        "nervous", "nervousness", "jittery", "anxious", "anxiety",
        "fidgety", "uneasy", "apprehensive", "tense", "stressed",
        "stress", "worry", "worried", "fret", "fretting",
        "restless", "on edge",
    ],
    "celebrate": [
        "celebrate", "celebration", "celebrating", "cheer", "cheering",
        "hooray", "hurray", "yay", "woohoo", "party", "partying",
        "congratulate", "congratulations", "congrats", "win", "winning",
        "champion", "success",
    ],
    "cry": [
        "cry", "crying", "sob", "sobbing", "weep", "weeping",
        "tears", "teary", "bawl", "bawling", "wail", "wailing",
        "heartbroken", "breakdown", "break down",
    ],
    "laugh": [
        "laugh", "laughing", "laughter", "giggle", "giggling",
        "chuckle", "chuckling", "cackle", "cackling", "haha",
        "lol", "hilarious", "amused", "amusing", "funny", "humor",
    ],
    "think": [
        "think", "thinking", "thought", "ponder", "pondering",
        "contemplate", "contemplating", "wonder", "wondering",
        "consider", "reflect", "reflecting", "muse", "daydream",
        "brainstorm", "plan", "planning", "decide", "meditate on",
    ],
    "panic": [
        "panic", "panicking", "frantic", "frantically", "hysteria",
        "hysterical", "lose it", "losing it", "out of control",
        "spiral", "meltdown", "freak out", "freaking out",
    ],
    "meditate": [
        "meditate", "meditating", "meditation", "mindful", "mindfulness",
        "zen", "calm", "calming", "peaceful", "peace", "serene",
        "serenity", "breathe", "breathing", "relax", "relaxing", "namaste",
    ],

    # ── Custom Clustered Actions ──────────────────────────────────────────────
    "eat": [
        "eat", "eating", "drink", "drinking", "chew", "chewing", "bite", "swallow", "taste",
    ],
    "toast": [
        "toast", "cheers", "toasting",
    ],
    "scrub": [
        "wash", "washing", "cook", "cooking", "clean", "cleaning", "sweep", "sweeping",
        "mop", "mopping", "build", "building", "fix", "fixing", "repair", "repairing", "dry", "drying",
    ],
    "sleep": [
        "sleep", "sleeping", "rest", "resting", "wake", "waking", "get up", "nap", "napping",
    ],
    "desk_work": [
        "read", "reading", "write", "writing", "study", "studying", "learn", "learning",
        "work", "working", "plan", "planning", "organize", "organizing",
    ],
    "gesturing": [
        "speak", "speaking", "talk", "talking", "say", "saying", "tell", "telling",
        "answer", "answering", "explain", "explaining", "message", "messaging", "call", "calling", "ask", "asking",
    ],
    "offer": [
        "give", "giving", "take", "taking", "share", "sharing", "help", "helping",
        "buy", "buying", "pay", "paying", "sell", "selling", "spend", "spending", "save", "saving",
        "order", "ordering", "choose", "choosing", "compare", "comparing", "return", "returning",
    ],
    "steer": [
        "drive", "driving", "ride", "riding",
    ],
    "climb": [
        "climb", "climbing",
    ],
    "lift": [
        "exercise", "exercising", "lift", "lifting", "push", "pushing", "pull", "pulling", "carry", "carrying",
        "breathe", "breathing",
    ],
    "sit": [
        "sit", "sitting", "relax", "relaxing",
    ],

    # ── Idle (fallback) ───────────────────────────────────────────────────────
    "idle": [
        "idle", "stand", "standing", "still", "wait", "waiting",
        "rest", "resting", "stop", "stopped", "nothing", "chill",
    ],
}

# ─── Emotion → base body animation (how the body moves for that emotion) ────
# Maps emotion states to their parent animation style
EMOTION_ANIM_BASE = {
    "happy":     "happy",
    "sad":       "sad",
    "angry":     "angry",
    "excited":   "excited",
    "scared":    "scared",
    "surprised": "surprised",
    "tired":     "tired",
    "confused":  "confused",
    "proud":     "proud",
    "bored":     "bored",
    "love":      "love",
    "nervous":   "nervous",
    "celebrate": "celebrate",
    "cry":       "cry",
    "laugh":     "laugh",
    "think":     "think",
    "panic":     "panic",
    "meditate":  "meditate",
}

# ─── Nonsense / hate content → idle ─────────────────────────────────────────
NONSENSE_PATTERNS = [
    r"\bhell\b", r"\bdead\b", r"\bdie\b", r"\bkill\b", r"\bblood\b",
    r"\bgod\b", r"\bdevil\b", r"\bsatan\b", r"\bcurse\b", r"\bpolitics\b",
    r"\bporn\b", r"\bnude\b", r"\bviolent\b", r"\bmurder\b",
]
NONSENSE_RE = re.compile("|".join(NONSENSE_PATTERNS), re.IGNORECASE)

# ─── Emoji → state map ───────────────────────────────────────────────────────
EMOJI_MAP: dict[str, str] = {
    # Actions
    "🏃": "run",     "🦘": "jump",    "💃": "dance",   "🕺": "dance",
    "🌊": "wave",    "✋": "wave",    "🌀": "spin",    "🛸": "float",
    "🚶": "walk",    "🧘": "meditate","🤸": "stretch", "🛩️": "float",
    # Emotions
    "😊": "happy",   "😄": "happy",   "🥳": "celebrate","🎉": "celebrate",
    "😢": "cry",     "😭": "cry",     "😔": "sad",     "💔": "sad",
    "😡": "angry",   "🤬": "angry",   "😤": "angry",   "😠": "angry",
    "😱": "scared",  "😨": "scared",  "😰": "nervous", "😬": "nervous",
    "😲": "surprised","😯": "surprised","🤯": "surprised",
    "😴": "tired",   "🥱": "tired",   "😵": "confused","🤔": "think",
    "💭": "think",   "🤩": "excited", "⚡": "excited", "🎊": "celebrate",
    "😎": "proud",   "🏆": "proud",   "🥇": "proud",   "😏": "proud",
    "😑": "bored",   "💤": "bored",   "😍": "love",    "❤️": "love",
    "💕": "love",    "🥰": "love",    "😆": "laugh",   "🤣": "laugh",
    "😂": "laugh",   "😅": "laugh",   "🏃‍♂️": "panic", "😰": "panic",
    "☮️": "meditate","🧿": "meditate",
}

# ─── Sentiments that map emotions to physical actions ─────────────────────────
# E.g. "I feel like dancing" → dance; "feeling like I want to fly" → float
CONTEXTUAL_FEELING_MAP: dict[str, str] = {
    "jumping for joy": "jump",
    "on top of the world": "celebrate",
    "feel like flying": "float",
    "feel like dancing": "dance",
    "running away": "run",
    "running scared": "panic",
    "frozen with fear": "scared",
    "shaking with anger": "angry",
    "bouncing off the walls": "excited",
    "dragging my feet": "tired",
}


def _emoji_hint(text: str) -> str | None:
    for emoji, state in EMOJI_MAP.items():
        if emoji in text:
            return state
    return None


def _contextual_match(text: str) -> str | None:
    tl = text.lower()
    for phrase, state in CONTEXTUAL_FEELING_MAP.items():
        if phrase in tl:
            return state
    return None


def _keyword_match(lemmas: list[str], raw_tokens: list[str], full_text: str) -> str | None:
    """Return first state whose keyword list overlaps with lemmas/tokens."""
    combined = set(lemmas + raw_tokens)
    full_lower = full_text.lower()

    for state, keywords in KEYWORD_MAP.items():
        if state == "idle":
            continue
        for kw in keywords:
            # Exact token match
            if kw in combined:
                return state
            # Substring match for multi-word keywords
            if " " in kw and kw in full_lower:
                return state
    return None


def classify_action(text: str) -> Tuple[str, float]:
    """
    Classify user text into one of the known animation states (action or emotion).

    Returns:
        (state_name, confidence)  where confidence in [0.0, 1.0]
    """
    if not text or not text.strip():
        return "idle", 1.0

    text_clean = text.strip()

    # 1. Block nonsense / harmful content → idle
    if NONSENSE_RE.search(text_clean):
        return "idle", 0.1

    # 2. Emoji hint (instant, highest confidence)
    emoji_state = _emoji_hint(text_clean)
    if emoji_state:
        return emoji_state, 0.97

    # 3. Contextual phrase match
    ctx = _contextual_match(text_clean)
    if ctx:
        return ctx, 0.92

    # 4. spaCy lemmatization — verbs, nouns, adjectives
    doc = nlp(text_clean.lower())
    lemmas     = [t.lemma_ for t in doc if t.pos_ in ("VERB", "NOUN", "ADJ") and not t.is_stop]
    raw_tokens = [t.text   for t in doc if not t.is_stop and not t.is_punct]

    # 5. Keyword match (lemmas + raw)
    matched = _keyword_match(lemmas, raw_tokens, text_clean)
    if matched:
        return matched, 0.85

    # 6. Substring scan on full text (catches compound words / misspellings)
    full_lower = text_clean.lower()
    for state, keywords in KEYWORD_MAP.items():
        if state == "idle":
            continue
        for kw in keywords:
            if kw in full_lower:
                return state, 0.70

    # 7. "Feeling" / "I am" soft prefix → try second token
    feeling_prefixes = [
        "i feel", "i am feeling", "feeling", "i am", "i'm",
        "make me", "make the figure", "show me", "i want to",
    ]
    for prefix in feeling_prefixes:
        if full_lower.startswith(prefix):
            remainder = full_lower[len(prefix):].strip()
            # Try matching remainder against keywords
            for state, keywords in KEYWORD_MAP.items():
                if state == "idle":
                    continue
                for kw in keywords:
                    if kw in remainder:
                        return state, 0.75

    # 8. Fuzzy matching for typos (e.g., "tierd" -> "tired", skip small words)
    import difflib
    all_kws = []
    kw_to_state = {}
    for state, keywords in KEYWORD_MAP.items():
        if state == "idle": continue
        for kw in keywords:
            all_kws.append(kw)
            kw_to_state[kw] = state
            
    # Check words that are >3 chars against the keyword dict
    for w in full_lower.split():
        if len(w) > 3:
            matches = difflib.get_close_matches(w, all_kws, n=1, cutoff=0.8)
            if matches:
                matched_kw = matches[0]
                return kw_to_state[matched_kw], 0.65

    # 9. Fallback → dynamic (for Gemini)
    return "dynamic", 0.3

def extract_display_text(text: str, max_chars: int = 40) -> str:
    """Return the text to display in the speech bubble (truncated if long)."""
    text = text.strip()
    if len(text) > max_chars:
        return text[:max_chars - 3] + "..."
    return text


def get_all_states() -> list[dict]:
    """Return all supported states with metadata for the frontend."""
    state_meta = {
        # Actions
        "jump":    {"type": "action",  "emoji": "🦘", "label": "Jump",    "color": "cyan"},
        "run":     {"type": "action",  "emoji": "🏃", "label": "Run",     "color": "pink"},
        "dance":   {"type": "action",  "emoji": "💃", "label": "Dance",   "color": "gold"},
        "spin":    {"type": "action",  "emoji": "🌀", "label": "Spin",    "color": "violet"},
        "wave":    {"type": "action",  "emoji": "✋", "label": "Wave",    "color": "cyan"},
        "walk":    {"type": "action",  "emoji": "🚶", "label": "Walk",    "color": "white"},
        "float":   {"type": "action",  "emoji": "🛸", "label": "Float",   "color": "violet"},
        "stretch": {"type": "action",  "emoji": "🤸", "label": "Stretch", "color": "gold"},
        # Emotions
        "happy":   {"type": "emotion", "emoji": "😊", "label": "Happy",   "color": "gold"},
        "sad":     {"type": "emotion", "emoji": "😢", "label": "Sad",     "color": "blue"},
        "angry":   {"type": "emotion", "emoji": "😡", "label": "Angry",   "color": "red"},
        "excited": {"type": "emotion", "emoji": "🤩", "label": "Excited", "color": "cyan"},
        "scared":  {"type": "emotion", "emoji": "😱", "label": "Scared",  "color": "violet"},
        "surprised":{"type":"emotion", "emoji": "😲", "label":"Surprised","color": "gold"},
        "tired":   {"type": "emotion", "emoji": "😴", "label": "Tired",   "color": "white"},
        "confused":{"type": "emotion", "emoji": "😵", "label": "Confused","color": "pink"},
        "proud":   {"type": "emotion", "emoji": "😎", "label": "Proud",   "color": "gold"},
        "bored":   {"type": "emotion", "emoji": "😑", "label": "Bored",   "color": "white"},
        "love":    {"type": "emotion", "emoji": "😍", "label": "Love",    "color": "pink"},
        "nervous": {"type": "emotion", "emoji": "😰", "label": "Nervous", "color": "cyan"},
        "celebrate":{"type":"emotion", "emoji": "🎉", "label":"Celebrate","color": "gold"},
        "cry":     {"type": "emotion", "emoji": "😭", "label": "Cry",     "color": "blue"},
        "laugh":   {"type": "emotion", "emoji": "😂", "label": "Laugh",   "color": "gold"},
        "think":   {"type": "emotion", "emoji": "🤔", "label": "Think",   "color": "violet"},
        "panic":   {"type": "emotion", "emoji": "😱", "label": "Panic",   "color": "red"},
        "meditate":{"type": "emotion", "emoji": "🧘", "label": "Meditate","color": "violet"},
        # ── Extended Clusters ──
        "eat":       {"type": "action",  "emoji": "🍔", "label": "Eat",     "color": "pink"},
        "toast":     {"type": "action",  "emoji": "🍻", "label": "Toast",   "color": "gold"},
        "scrub":     {"type": "action",  "emoji": "🧽", "label": "Scrub",   "color": "cyan"},
        "sleep":     {"type": "action",  "emoji": "🛌", "label": "Sleep",   "color": "red"},
        "desk_work": {"type": "action",  "emoji": "💻", "label": "Work",    "color": "white"},
        "gesturing": {"type": "action",  "emoji": "🗣️", "label": "Speak",   "color": "cyan"},
        "offer":     {"type": "action",  "emoji": "🤲", "label": "Give",    "color": "gold"},
        "steer":     {"type": "action",  "emoji": "🚗", "label": "Drive",   "color": "blue"},
        "climb":     {"type": "action",  "emoji": "🧗", "label": "Climb",   "color": "gold"},
        "lift":      {"type": "action",  "emoji": "🏋️", "label": "Lift",    "color": "violet"},
        "sit":       {"type": "action",  "emoji": "🪑", "label": "Sit",     "color": "white"},
        
        # Fallback
        "idle":    {"type": "action",  "emoji": "🧍", "label": "Idle",    "color": "white"},
    }
    return [{"id": k, **v} for k, v in state_meta.items()]


if __name__ == "__main__":
    tests = [
        # Actions
        ("jumping high",           "jump"),
        ("Go to the hell",         "idle"),
        ("I love dancing",         "dance"),
        ("spinning around",        "spin"),
        ("wave hello",             "wave"),
        ("run fast",               "run"),
        ("floating in zero-g",     "float"),
        ("xyzqwerty",              "idle"),
        # Emotions
        ("I am so happy",          "happy"),
        ("feeling sad today",      "sad"),
        ("I am furious",           "angry"),
        ("so excited!!!",          "excited"),
        ("terrified of spiders",   "scared"),
        ("OMG I'm so surprised",   "surprised"),
        ("exhausted and tired",    "tired"),
        ("I'm so confused",        "confused"),
        ("feeling proud",          "proud"),
        ("this is so boring",      "bored"),
        ("I love you",             "love"),
        ("I'm so nervous",         "nervous"),
        ("celebrate with me",      "celebrate"),
        ("I want to cry",          "cry"),
        ("can't stop laughing",    "laugh"),
        ("thinking about life",    "think"),
        ("absolute panic",         "panic"),
        ("let's meditate",         "meditate"),
        # Emojis
        ("😡",                     "angry"),
        ("🎉",                     "celebrate"),
        ("🤔",                     "think"),
        # Contextual
        ("jumping for joy",        "jump"),
        ("feel like flying",       "float"),
    ]
    print(f"{'Input':<40} {'Got':<12} {'Exp':<12} {'Conf':>6}  {'OK'}")
    print("-" * 80)
    fails = 0
    for text, expected in tests:
        action, conf = classify_action(text)
        ok = "OK" if action == expected else "FAIL"
        if action != expected:
            fails += 1
        print(f"{text!r:<40} {action:<12} {expected:<12} {conf:>6.2f}  {ok}")
    print()
    print(f"Results: {len(tests)-fails}/{len(tests)} passed")
