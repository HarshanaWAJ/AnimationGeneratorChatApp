const fs = require('fs');

const PREFIXES = [
    "I just wanted to say that ",
    "Could you please tell me if ",
    "I am currently feeling like ",
    "Right now, ",
    "Excuse me, but ",
    "Hey there, ",
    "Listen carefully, ",
    "As a matter of fact, ",
    "I need to let you know that ",
    "Honestly, ",
    "If I am being completely honest, ",
    "Please understand that ",
    "Can you believe that ",
    "I want to tell you that ",
    "By the way, ",
    "It is important that ",
    "I'm not sure but "
];

const SUFFIXES = [
    " right now.",
    " today.",
    " as soon as possible.",
    " my friend.",
    ", okay?",
    " because I really mean it.",
    " for the time being.",
    ", if that makes sense.",
    " and I mean it.",
    " so please listen.",
    " in the morning.",
    " tonight."
];

function loadDataset(filepath) {
    if (!fs.existsSync(filepath)) return [];
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    const data = [];
    for (const line of lines) {
        if (line.trim()) {
            data.push(JSON.parse(line.trim()));
        }
    }
    return data;
}

function augment(data) {
    const augmented = [];
    const seen = new Set();
    data.forEach(d => seen.add(d.input_text.toLowerCase()));
    
    const specifics = [
        {input_text: "Good morning to you", animation_hint: "stretches and smiles"},
        {input_text: "Wishing you a great morning", animation_hint: "stretches and smiles"},
        {input_text: "Wake up it is morning", animation_hint: "stretches and smiles"},
        {input_text: "Good night and sleep well", animation_hint: "good night"},
        {input_text: "I am going to sleep now good night", animation_hint: "good night"},
        {input_text: "It is late so good night", animation_hint: "good night"},
        {input_text: "Hello how are you doing", animation_hint: "waves hand"},
        {input_text: "Hi there my friend", animation_hint: "waves hand"},
        {input_text: "Greetings to you all", animation_hint: "waves hand"},
    ];
    
    for (const s of specifics) {
        if (!seen.has(s.input_text.toLowerCase())) {
            augmented.push(s);
            seen.add(s.input_text.toLowerCase());
        }
    }
            
    const newItems = [];
    for (const item of data) {
        const text = item.input_text;
        const hint = item.animation_hint;
        
        for (let i = 0; i < 3; i++) {
            const pref = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
            const suff = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
            
            const t1 = pref + text.toLowerCase();
            if (!seen.has(t1.toLowerCase())) {
                newItems.push({input_text: t1, animation_hint: hint});
                seen.add(t1.toLowerCase());
            }
                
            const t2 = text + suff;
            if (!seen.has(t2.toLowerCase())) {
                newItems.push({input_text: t2, animation_hint: hint});
                seen.add(t2.toLowerCase());
            }
                
            const t3 = pref + text.toLowerCase() + suff;
            if (!seen.has(t3.toLowerCase())) {
                newItems.push({input_text: t3, animation_hint: hint});
                seen.add(t3.toLowerCase());
            }
        }
    }
                
    augmented.push(...newItems);
    return augmented;
}

function saveDataset(filepath, original, augmented) {
    const fd = fs.openSync(filepath, 'w');
    for (const item of original) {
        fs.writeSync(fd, JSON.stringify(item) + '\n');
    }
    for (const item of augmented) {
        fs.writeSync(fd, JSON.stringify(item) + '\n');
    }
    fs.closeSync(fd);
}

const path = process.argv[2];
const original = loadDataset(path);
const augmented = augment(original);
saveDataset(path, original, augmented);
console.log(`Added ${augmented.length} new variations to ${path}`);
