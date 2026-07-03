import json
import os

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

def get_all_combinations(base_text, hint):
    combos = []
    # 1. Base text alone
    combos.append({"input_text": base_text, "animation_hint": hint})
    
    # 2. Prefix + Base
    for p in PREFIXES:
        combos.append({"input_text": p + base_text.lower(), "animation_hint": hint})
        
    # 3. Base + Suffix
    for s in SUFFIXES:
        combos.append({"input_text": base_text + s, "animation_hint": hint})
        
    # 4. Prefix + Base + Suffix
    for p in PREFIXES:
        for s in SUFFIXES:
            combos.append({"input_text": p + base_text.lower() + s, "animation_hint": hint})
            
    return combos

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (does not exist)")
        return
    
    # Read existing
    data = []
    seen = set()
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                item = json.loads(line.strip())
                # Ensure mapping to happy birthday for birthday wishes
                if "birthday wishes" in item['input_text'].lower():
                    item['animation_hint'] = "happy birthday"
                
                if item['input_text'].lower() not in seen:
                    data.append(item)
                    seen.add(item['input_text'].lower())
                    
    # Generate all possibilities for "Birthday Wishes" and "Happy birthday"
    new_items = []
    new_items.extend(get_all_combinations("Birthday wishes", "happy birthday"))
    new_items.extend(get_all_combinations("Happy birthday", "happy birthday"))
    
    added_count = 0
    for item in new_items:
        if item['input_text'].lower() not in seen:
            data.append(item)
            seen.add(item['input_text'].lower())
            added_count += 1
            
    # Save back
    with open(filepath, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item) + '\n')
    print(f"Processed {filepath}: added {added_count} items. Total: {len(data)}")
            
for path in ['LLM/data/dataset.jsonl', 'backend/data/dataset.jsonl', 'backend/nlp/data/dataset.jsonl']:
    process_file(path)
