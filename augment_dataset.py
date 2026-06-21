import json
import random
import sys

PREFIXES = [
    "I just wanted to say that ",
    "Could you please tell me if ",
    "I am currently feeling like ",
    "Right now, ",
    "Excuse me, but ",
    "Hey there, ",
    "Listen carefully, ",
    "As a matter of fact, ",
    "I need to let you know that ",
    "Honestly, ",
    "If I am being completely honest, ",
    "Please understand that ",
    "Can you believe that ",
    "I want to tell you that ",
    "By the way, ",
    "It is important that ",
    "I'm not sure but "
]

SUFFIXES = [
    " right now.",
    " today.",
    " as soon as possible.",
    " my friend.",
    ", okay?",
    " because I really mean it.",
    " for the time being.",
    ", if that makes sense.",
    " and I mean it.",
    " so please listen.",
    " in the morning.",
    " tonight."
]

def load_dataset(filepath):
    data = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line.strip()))
    return data

def augment(data):
    augmented = []
    seen = set(d['input_text'].lower() for d in data)
    
    specifics = [
        {"input_text": "Good morning to you", "animation_hint": "stretches and smiles"},
        {"input_text": "Wishing you a great morning", "animation_hint": "stretches and smiles"},
        {"input_text": "Wake up it is morning", "animation_hint": "stretches and smiles"},
        {"input_text": "Good night and sleep well", "animation_hint": "good night"},
        {"input_text": "I am going to sleep now good night", "animation_hint": "good night"},
        {"input_text": "It is late so good night", "animation_hint": "good night"},
        {"input_text": "Hello how are you doing", "animation_hint": "waves hand"},
        {"input_text": "Hi there my friend", "animation_hint": "waves hand"},
        {"input_text": "Greetings to you all", "animation_hint": "waves hand"},
    ]
    for s in specifics:
        if s['input_text'].lower() not in seen:
            augmented.append(s)
            seen.add(s['input_text'].lower())
            
    new_items = []
    for item in data:
        text = item['input_text']
        hint = item['animation_hint']
        
        for _ in range(3):
            pref = random.choice(PREFIXES)
            suff = random.choice(SUFFIXES)
            
            t1 = pref + text.lower()
            if t1.lower() not in seen:
                new_items.append({"input_text": t1, "animation_hint": hint})
                seen.add(t1.lower())
                
            t2 = text + suff
            if t2.lower() not in seen:
                new_items.append({"input_text": t2, "animation_hint": hint})
                seen.add(t2.lower())
                
            t3 = pref + text.lower() + suff
            if t3.lower() not in seen:
                new_items.append({"input_text": t3, "animation_hint": hint})
                seen.add(t3.lower())
                
    augmented.extend(new_items)
    return augmented

def save_dataset(filepath, original, augmented):
    with open(filepath, 'w', encoding='utf-8') as f:
        for item in original:
            f.write(json.dumps(item) + '\n')
        for item in augmented:
            f.write(json.dumps(item) + '\n')

path = sys.argv[1]
original = load_dataset(path)
augmented = augment(original)
save_dataset(path, original, augmented)
print(f"Added {len(augmented)} new variations to {path}")
