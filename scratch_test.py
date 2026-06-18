from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')

# Old targets
old_targets = ["stretches and smiles", "good night"]
old_emb = model.encode(old_targets)

# New targets
new_targets = ["Good morning", "Good night"]
new_emb = model.encode(new_targets)

queries = [
    "Good morning",
    "Good morning, I hope you have a wonderful day ahead!",
    "I'm feeling really tired and want to go to sleep now, good night.",
    "I had a really long day at work today and I am extremely tired right now"
]
q_emb = model.encode(queries)

print("Old targets (matching against labels):")
for i, q in enumerate(queries):
    sims = cosine_similarity([q_emb[i]], old_emb)[0]
    best_idx = np.argmax(sims)
    print(f"Q: {q[:30]}... -> Best: {old_targets[best_idx]} (score: {sims[best_idx]:.2f})")

print("\nNew targets (matching against dataset sentences):")
for i, q in enumerate(queries):
    sims = cosine_similarity([q_emb[i]], new_emb)[0]
    best_idx = np.argmax(sims)
    print(f"Q: {q[:30]}... -> Best: {new_targets[best_idx]} (score: {sims[best_idx]:.2f})")

# Let's add more dataset sentences
dataset = ["Good morning", "Good night", "I am tired", "I need to rest"]
dataset_emb = model.encode(dataset)
print("\nNew targets with 'I am tired':")
for i, q in enumerate(queries):
    sims = cosine_similarity([q_emb[i]], dataset_emb)[0]
    best_idx = np.argmax(sims)
    print(f"Q: {q[:30]}... -> Best: {dataset[best_idx]} (score: {sims[best_idx]:.2f})")

