import os
import shutil
import subprocess
from pathlib import Path

PROJECT_ROOT = r"e:\Software Projects\Mobile\AnimationGeneratorChatApp"
LLM_DIR = os.path.join(PROJECT_ROOT, "LLM")

backend_model_v3 = os.path.join(PROJECT_ROOT, "backend", "model_v3")
llm_model_dir = os.path.join(LLM_DIR, "model_updated")

os.makedirs(backend_model_v3, exist_ok=True)

# Copy the finetuned_model
src_finetuned = os.path.join(llm_model_dir, "finetuned_model")
dst_finetuned = os.path.join(backend_model_v3, "finetuned_model")
if os.path.exists(src_finetuned):
    if not os.path.exists(dst_finetuned):
        shutil.copytree(src_finetuned, dst_finetuned)

# Copy the embeddings
src_embeddings = os.path.join(llm_model_dir, "embeddings.npz")
dst_embeddings = os.path.join(backend_model_v3, "embeddings.npz")
if os.path.exists(src_embeddings):
    shutil.copy2(src_embeddings, dst_embeddings)

print("Copied to model_v3")
