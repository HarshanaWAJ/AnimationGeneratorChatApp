import asyncio
from backend.nlp.classifier import classify_action
from backend.nlp.gemini_generator import generate_dynamic_keyframes

def main():
    prompt = "Kick a soccer ball"
    action, conf = classify_action(prompt)
    print(f"Prompt: {prompt}")
    print(f"Action: {action}, Confidence: {conf}")

    if action == "dynamic":
        print("Calling Gemini generator...")
        kf = generate_dynamic_keyframes(prompt)
        print(f"Generated {len(kf)} keyframes.")
        if len(kf) > 0:
            print("First Keyframe:")
            print(kf[0])
    
if __name__ == "__main__":
    main()
