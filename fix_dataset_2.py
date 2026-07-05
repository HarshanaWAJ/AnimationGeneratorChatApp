import json
import os
import shutil
import subprocess

PROJECT_ROOT = r"e:\Software Projects\Mobile\AnimationGeneratorChatApp"
LLM_DIR = os.path.join(PROJECT_ROOT, "LLM")
DATASET_PATH = os.path.join(LLM_DIR, "data", "dataset.jsonl")

# 1. Update dataset
new_entries = [
    {"input_text": "I am going to school tomorrow", "animation_hint": "school tomorrow"},
    {"input_text": "I am going to the office tomorrow", "animation_hint": "office tomorrow"},
    {"input_text": "I am going to the work tomorrow", "animation_hint": "office tommorow"},
    {"input_text": "I will go to school tomorrow", "animation_hint": "school tomorrow"},
    {"input_text": "I will go to the office tomorrow", "animation_hint": "office tomorrow"},
    {"input_text": "I will go to work tomorrow", "animation_hint": "office tommorow"},
    {"input_text": "We will play cricket tomorrow", "animation_hint": "play tomorrow"},
    {"input_text": "We will play tomorrow", "animation_hint": "play tomorrow"},
    {"input_text": "I will play cricket tomorrow", "animation_hint": "play tomorrow"},
    {"input_text": "I will play tomorrow", "animation_hint": "play tomorrow"},
    {"input_text": "I will write tomorrow", "animation_hint": "write tomorrow"},
    {"input_text": "I will study tomorrow", "animation_hint": "study tomorrow"},
    {"input_text": "I will cook tomorrow", "animation_hint": "cook tomorrow"},
    {"input_text": "I will teach tomorrow", "animation_hint": "teach tomorrow"},
    {"input_text": "I am sewing", "animation_hint": "sewing"},
    {"input_text": "Sewing", "animation_hint": "sewing"},
    {"input_text": "Apple", "animation_hint": "apple"},
    {"input_text": "This is an apple", "animation_hint": "apple"},
    {"input_text": "give me the apple", "animation_hint": "apple"},
    {"input_text": "I have an apple", "animation_hint": "apple"},
    {"input_text": "Mother", "animation_hint": "mother"},
    {"input_text": "This is my mother", "animation_hint": "mother"},
    {"input_text": "Father", "animation_hint": "father"},
    {"input_text": "I love my father", "animation_hint": "father"},
    {"input_text": "Give me a hug", "animation_hint": "father"},
    {"input_text": "I had a good sleep yesterday", "animation_hint": "slept yesterday"},
    {"input_text": "I slept yesterday", "animation_hint": "slept yesterday"},
    {"input_text": "I was happy yesterday", "animation_hint": "happy yesterday"},
    {"input_text": "I was sick yesterday", "animation_hint": "sick yesterday"},
    {"input_text": "I studied yesterday", "animation_hint": "studied yesterday"},
    {"input_text": "I cleaned yesterday", "animation_hint": "cleaned yesterday"},
    {"input_text": "I played yesterday", "animation_hint": "played yesterday"},
    {"input_text": "I played football yesterday", "animation_hint": "played yesterday"},
    {"input_text": "I played with a ball yesterday", "animation_hint": "played yesterday"},
    {"input_text": "I went to school yesterday", "animation_hint": "school yesterday"},
    {"input_text": "I went to the office yesterday", "animation_hint": "office yesterday"},
    {"input_text": "I went to the work yesterday", "animation_hint": "office yesterday"},
    {"input_text": "I am going to school next week", "animation_hint": "school next week"},
    {"input_text": "I will go to school next week", "animation_hint": "school next week"},
    {"input_text": "It will rain tomorrow", "animation_hint": "rain tomorrow"}
]

# Write to dataset
with open(DATASET_PATH, "r", encoding="utf-8") as f:
    existing_data = [json.loads(line) for line in f if line.strip()]

# Remove old conflicting entries or just append. We will append and also override any exact input_text match
new_inputs = {entry["input_text"].lower(): entry for entry in new_entries}
final_data = []
for item in existing_data:
    if item["input_text"].lower() not in new_inputs:
        final_data.append(item)
final_data.extend(new_entries)

with open(DATASET_PATH, "w", encoding="utf-8") as f:
    for item in final_data:
        f.write(json.dumps(item) + "\n")

print("Dataset updated.")

# 2. Rename mp4 files (underscore -> spaces)
llm_anim = os.path.join(LLM_DIR, "data", "animations")
for fname in os.listdir(llm_anim):
    if fname.endswith(".mp4") and "_" in fname:
        # e.g. cook_tomorrow.mp4 -> cook tomorrow.mp4
        new_name = fname.replace("_", " ")
        src = os.path.join(llm_anim, fname)
        dst = os.path.join(llm_anim, new_name)
        if not os.path.exists(dst):
            os.rename(src, dst)
            print(f"Renamed {fname} to {new_name}")

# Also explicitly handle the typo just in case
office_tomorrow = os.path.join(llm_anim, "office tomorrow.mp4")
office_tommorow = os.path.join(llm_anim, "office tommorow.mp4")
if os.path.exists(office_tomorrow) and not os.path.exists(office_tommorow):
    shutil.copy2(office_tomorrow, office_tommorow)
    print("Created office tommorow.mp4 as a copy of office tomorrow.mp4")

# 3. Train the model
print("Training model...")
python_exe = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
train_script = os.path.join(LLM_DIR, "train.py")
subprocess.run([python_exe, train_script], cwd=LLM_DIR, check=True)

# 4. Copy to backend
backend_anim = os.path.join(PROJECT_ROOT, "backend", "data", "animations")
os.makedirs(backend_anim, exist_ok=True)
for fname in os.listdir(llm_anim):
    if fname.endswith(".mp4"):
        src = os.path.join(llm_anim, fname)
        dst = os.path.join(backend_anim, fname)
        shutil.copy2(src, dst)

backend_model_dir = os.path.join(PROJECT_ROOT, "backend", "model_updated")
llm_model_dir = os.path.join(LLM_DIR, "model_updated")
src_finetuned = os.path.join(llm_model_dir, "finetuned_model")
dst_finetuned = os.path.join(backend_model_dir, "finetuned_model")
if os.path.exists(src_finetuned):
    if os.path.exists(dst_finetuned):
        shutil.rmtree(dst_finetuned, ignore_errors=True)
    shutil.copytree(src_finetuned, dst_finetuned)

src_embeddings = os.path.join(llm_model_dir, "embeddings.npz")
dst_embeddings = os.path.join(backend_model_dir, "embeddings.npz")
if os.path.exists(src_embeddings):
    shutil.copy2(src_embeddings, dst_embeddings)

backend_dataset = os.path.join(PROJECT_ROOT, "backend", "data", "dataset.jsonl")
shutil.copy2(DATASET_PATH, backend_dataset)

print("Done copying to backend.")
