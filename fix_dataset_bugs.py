import os
import json
import subprocess
import shutil

PROJECT_ROOT = r"c:\Users\janit\Desktop\JH_Software_Solutions\LLM\AnimationGeneratorChatApp"
LLM_DIR = os.path.join(PROJECT_ROOT, "LLM")
BACKEND_DATASET_1 = os.path.join(PROJECT_ROOT, "backend", "data", "dataset.jsonl")
BACKEND_DATASET_2 = os.path.join(PROJECT_ROOT, "backend", "nlp", "data", "dataset.jsonl")

def update_dataset(path):
    if not os.path.exists(path):
        return
    data = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                item = json.loads(line.strip())
                # Fix typo in "office tommorow"
                if item.get("animation_hint") == "office tommorow":
                    item["animation_hint"] = "office tomorrow"
                data.append(item)
                
    # Define exact mappings to append
    target_mappings = [
        {"input_text": "I am studying", "animation_hint": "book open"},
        {"input_text": "I will go office", "animation_hint": "office tomorrow"},
        {"input_text": "I play badminton", "animation_hint": "badminton"}
    ]
    
    # Remove existing ones with these exact inputs to avoid duplication
    target_inputs = [x["input_text"].lower() for x in target_mappings]
    
    filtered_data = [item for item in data if item["input_text"].lower() not in target_inputs]
    filtered_data.extend(target_mappings)
    
    with open(path, "w", encoding="utf-8") as f:
        for item in filtered_data:
            f.write(json.dumps(item) + "\n")
    print(f"Updated {path}")
    return path

if __name__ == "__main__":
    p1 = update_dataset(BACKEND_DATASET_1)
    p2 = update_dataset(BACKEND_DATASET_2)
    
    # Also create the LLM/data/dataset.jsonl so training works
    os.makedirs(os.path.join(LLM_DIR, "data"), exist_ok=True)
    llm_dataset = os.path.join(LLM_DIR, "data", "dataset.jsonl")
    shutil.copy2(BACKEND_DATASET_1, llm_dataset)
    print("Copied dataset to LLM/data/dataset.jsonl")
    
    # Train the model
    print("Training model...")
    python_exe = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
    train_script = os.path.join(LLM_DIR, "train.py")
    subprocess.run([python_exe, train_script], cwd=LLM_DIR, check=True)
    
    # Copy model to backend model_v4 (since backend uses model_v4)
    model_output_dir = os.path.join(LLM_DIR, "model_updated")
    backend_model_v4 = os.path.join(PROJECT_ROOT, "backend", "model_v4")
    
    if os.path.exists(model_output_dir):
        if os.path.exists(backend_model_v4):
            shutil.rmtree(backend_model_v4)
        shutil.copytree(model_output_dir, backend_model_v4)
        print("Copied trained model to backend/model_v4")
    else:
        print("Model output dir not found!")
