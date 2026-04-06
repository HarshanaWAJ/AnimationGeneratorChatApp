import os
from pathlib import Path
from dotenv import load_dotenv

# Mimic the location of gemini_generator.py: backend/nlp/
this_file = Path("e:/Software Projects/Mobile/AnimationGeneratorChatApp/backend/nlp/gemini_generator.py")
env_path = this_file.parent.parent / ".env"
print(f"Computed path: {env_path}")
print(f"Path exists: {env_path.exists()}")

load_dotenv(dotenv_path=env_path)
key = os.getenv("GEMINI_API_KEY")
print(f"Key: {key}")
