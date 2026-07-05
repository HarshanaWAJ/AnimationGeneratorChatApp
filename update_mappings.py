import json
import os
import shutil

DATASET_PATH = r"e:\Software Projects\Mobile\AnimationGeneratorChatApp\LLM\data\dataset.jsonl"

def update_dataset():
    # Read existing
    data = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line.strip()))
                
    # Overwrite conflicting entries or just append
    # To be safe, let's remove any entry that maps 'hi', 'hello', 'greetings', 'happy birthday' to something else
    # and then add our own.
    
    target_inputs = ["hi", "hello", "greetings", "hi there", "hello there", "greetings to you", "happy birthday", "wishing you a happy birthday", "birthday wishes", "happy birthday to you"]
    
    filtered_data = []
    for item in data:
        text = item["input_text"].lower().strip()
        if text not in target_inputs:
            filtered_data.append(item)
            
    # Add correct mappings
    filtered_data.append({"input_text": "hi", "animation_hint": "waves hand"})
    filtered_data.append({"input_text": "hello", "animation_hint": "waves hand"})
    filtered_data.append({"input_text": "greetings", "animation_hint": "waves hand"})
    filtered_data.append({"input_text": "hi there", "animation_hint": "waves hand"})
    filtered_data.append({"input_text": "hello there", "animation_hint": "waves hand"})
    filtered_data.append({"input_text": "greetings to you", "animation_hint": "waves hand"})
    
    filtered_data.append({"input_text": "happy birthday", "animation_hint": "happy birthday"})
    filtered_data.append({"input_text": "wishing you a happy birthday", "animation_hint": "happy birthday"})
    filtered_data.append({"input_text": "birthday wishes", "animation_hint": "happy birthday"})
    filtered_data.append({"input_text": "happy birthday to you", "animation_hint": "happy birthday"})

    # Write back
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        for item in filtered_data:
            f.write(json.dumps(item) + "\n")
    print(f"Updated dataset. Now has {len(filtered_data)} entries.")

if __name__ == "__main__":
    update_dataset()
