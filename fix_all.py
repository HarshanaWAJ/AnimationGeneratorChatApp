import json
import os
import shutil
import subprocess

PROJECT_ROOT = r"e:\Software Projects\Mobile\AnimationGeneratorChatApp"
LLM_DIR = os.path.join(PROJECT_ROOT, "LLM")
DATASET_PATH = os.path.join(LLM_DIR, "data", "dataset.jsonl")

def update_dataset():
    data = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line.strip()))
                
    target_inputs = [
        "hi", "hello", "greetings", "hi there", "hello there", "greetings to you",
        "happy birthday", "wishing you a happy birthday", "birthday wishes", "happy birthday to you"
    ]
    
    filtered_data = []
    for item in data:
        text = item["input_text"].lower().strip()
        if text not in target_inputs:
            filtered_data.append(item)
            
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

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        for item in filtered_data:
            f.write(json.dumps(item) + "\n")

def copy_files_to_backend():
    backend_animations_dir = os.path.join(PROJECT_ROOT, "backend", "data", "animations")
    llm_animations_dir = os.path.join(LLM_DIR, "data", "animations")
    
    os.makedirs(backend_animations_dir, exist_ok=True)
    
    for filename in os.listdir(llm_animations_dir):
        if filename.endswith(".mp4"):
            src = os.path.join(llm_animations_dir, filename)
            dst = os.path.join(backend_animations_dir, filename)
            if not os.path.exists(dst):
                try:
                    shutil.copy2(src, dst)
                    print(f"Copied animation {filename} to backend.")
                except Exception as e:
                    print(f"Failed to copy {filename}: {e}")
                
    # Copy models to new path 'model_updated' to avoid file lock issues
    backend_model_dir = os.path.join(PROJECT_ROOT, "backend", "model_updated")
    llm_model_dir = os.path.join(LLM_DIR, "model_updated")
    
    os.makedirs(backend_model_dir, exist_ok=True)
    
    src_finetuned = os.path.join(llm_model_dir, "finetuned_model")
    dst_finetuned = os.path.join(backend_model_dir, "finetuned_model")
    if os.path.exists(src_finetuned):
        if os.path.exists(dst_finetuned):
            shutil.rmtree(dst_finetuned, ignore_errors=True)
        shutil.copytree(src_finetuned, dst_finetuned)
        print("Copied finetuned_model to backend/model_updated.")
        
    src_embeddings = os.path.join(llm_model_dir, "embeddings.npz")
    dst_embeddings = os.path.join(backend_model_dir, "embeddings.npz")
    if os.path.exists(src_embeddings):
        shutil.copy2(src_embeddings, dst_embeddings)
        print("Copied embeddings.npz to backend/model_updated.")
        
    backend_dataset = os.path.join(PROJECT_ROOT, "backend", "data", "dataset.jsonl")
    shutil.copy2(DATASET_PATH, backend_dataset)

if __name__ == "__main__":
    print("Step 1: Updating dataset mappings...")
    update_dataset()
    
    print("\nStep 2: Training LLM model (using new output dir)...")
    python_exe = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
    train_script = os.path.join(LLM_DIR, "train.py")
    try:
        subprocess.run([python_exe, train_script], cwd=LLM_DIR, check=True)
        print("Model training completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error during training: {e}")
        
    print("\nStep 3: Copying trained models to backend/model_updated...")
    copy_files_to_backend()
    print("All tasks completed.")
