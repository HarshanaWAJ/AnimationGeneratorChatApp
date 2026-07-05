import json
import os
import shutil
import subprocess

PROJECT_ROOT = r"e:\Software Projects\Mobile\AnimationGeneratorChatApp"
LLM_DIR = os.path.join(PROJECT_ROOT, "LLM")
DATASET_PATH = os.path.join(LLM_DIR, "data", "dataset.jsonl")

# 1. Update dataset
new_entries = [
    {"input_text": "Happy Birthday", "animation_hint": "happy birthday"},
    {"input_text": "Happy birthday", "animation_hint": "happy birthday"},
    {"input_text": "HAPPY BIRTHDAY", "animation_hint": "happy birthday"},
]

with open(DATASET_PATH, "a", encoding="utf-8") as f:
    for item in new_entries:
        f.write(json.dumps(item) + "\n")

print("Dataset updated with case-sensitive birthday mappings.")

# 2. Train the model
print("Training model...")
python_exe = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
train_script = os.path.join(LLM_DIR, "train.py")
subprocess.run([python_exe, train_script], cwd=LLM_DIR, check=True)

# 3. Copy to backend
backend_model_v4 = os.path.join(PROJECT_ROOT, "backend", "model_v4")
llm_model_dir = os.path.join(LLM_DIR, "model_updated")

os.makedirs(backend_model_v4, exist_ok=True)
src_finetuned = os.path.join(llm_model_dir, "finetuned_model")
dst_finetuned = os.path.join(backend_model_v4, "finetuned_model")
if os.path.exists(src_finetuned):
    shutil.copytree(src_finetuned, dst_finetuned, dirs_exist_ok=True)

src_embeddings = os.path.join(llm_model_dir, "embeddings.npz")
dst_embeddings = os.path.join(backend_model_v4, "embeddings.npz")
if os.path.exists(src_embeddings):
    shutil.copy2(src_embeddings, dst_embeddings)

backend_dataset = os.path.join(PROJECT_ROOT, "backend", "data", "dataset.jsonl")
shutil.copy2(DATASET_PATH, backend_dataset)

print("Done copying to backend model_v4.")
