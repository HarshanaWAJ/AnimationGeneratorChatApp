import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path("e:/Software Projects/Mobile/AnimationGeneratorChatApp/backend/.env")
print(f"Path exists: {env_path.exists()}")
load_dotenv(dotenv_path=env_path)
key = os.getenv("GEMINI_API_KEY")
print(f"Key found: {key is not None}")
if key:
    print(f"Key value: {key[:10]}...")
else:
    print("Key not found")
