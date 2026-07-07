const Message = require('../models/Message');
const User = require('../models/User');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Send Message (Text or Voice)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, type, text: input_text } = req.body;
    const senderId = req.user.id;
    let final_text = input_text || '';
    let gifData = null;
    let audioData = null;

    // 1. If voice message: M4A → WAV (PCM 16kHz mono) → transcribe → treat as text
    if (type === 'voice') {
      if (!req.file) {
        console.error('❌ Voice message received but no audio file attached!');
        return res.status(400).json({ message: 'Voice file missing from request' });
      }

      const audio_path = req.file.path;
      const wav_path   = audio_path + '.wav';
      console.log('🎙️  Voice received — file saved at:', audio_path);

      const cleanupTempFiles = () => {
        try { fs.unlinkSync(audio_path); } catch (_) {}
        try { if (fs.existsSync(wav_path)) fs.unlinkSync(wav_path); } catch (_) {}
      };

      // Step 1: Convert to PCM 16kHz mono WAV (required by speech_recognition AudioFile)
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(audio_path)
            .audioCodec('pcm_s16le')   // PCM signed 16-bit little-endian
            .audioFrequency(16000)     // 16 kHz sample rate
            .audioChannels(1)          // mono
            .toFormat('wav')
            .on('start',  (cmd) => console.log('🔧 FFmpeg command:', cmd))
            .on('end',    ()    => { console.log('✅ FFmpeg → WAV done'); resolve(); })
            .on('error',  (err) => { console.error('❌ FFmpeg error:', err.message); reject(err); })
            .save(wav_path);
        });
      } catch (ffmpegErr) {
        cleanupTempFiles();
        return res.status(500).json({ message: 'Audio conversion failed: ' + ffmpegErr.message });
      }

      // Step 2: Read the WAV bytes and POST to Python /api/transcribe
      let transcribed = '';
      try {
        const transcribeData = new FormData();
        transcribeData.append('file', fs.createReadStream(wav_path), {
          filename: 'audio.wav',
          contentType: 'audio/wav',
        });

        const ANIM_URL = process.env.ANIMATION_SERVICE_URL || 'http://localhost:8000';
        console.log('📡 POSTing WAV to', `${ANIM_URL}/api/transcribe`);

        const transcribeRes = await axios.post(`${ANIM_URL}/api/transcribe`, transcribeData, {
          headers: { ...transcribeData.getHeaders() },
          timeout: 60000,
        });

        transcribed = (transcribeRes.data.text || '').trim();
        console.log('📝 Transcription result:', transcribed || '(empty — unintelligible)');

      } catch (transcribeErr) {
        console.error('❌ Transcription call failed:', transcribeErr.response?.data || transcribeErr.message);
        cleanupTempFiles();
        return res.status(500).json({
          message: 'Voice transcription failed. Is the Python server running? (' + (transcribeErr.message || 'unknown') + ')'
        });
      }

      // Always clean up temp files after transcription completes
      cleanupTempFiles();

      if (!transcribed) {
        return res.status(422).json({
          message: 'Could not understand the voice message. Please speak clearly and try again.'
        });
      }

      // Treat transcribed text exactly like a typed text message
      final_text = transcribed;
      console.log('✅ Voice → text:', final_text);
    }

    // Guard: must have some text content by now
    if (!final_text || !final_text.trim()) {
      return res.status(400).json({ message: 'No message content to send' });
    }

    // Advanced Mapping Logic to fix meaning mapping (especially for long sentences)
    const lowerText = final_text.toLowerCase();
    let action_text = final_text;

    // ── Exact sport / activity mappings (must be first — most specific) ────────
    if (lowerText.includes('badminton') || lowerText.includes('play badminton')) {
      // Maps to badminton.mp4
      action_text = 'badminton';
    }
    // Study / Studying -> book open.mp4
    else if (lowerText.includes('studi') || lowerText.includes('studying') || lowerText.includes('reading') || lowerText.includes('i am learning') || lowerText.includes('i am studing')) {
      // Maps to 'book open.mp4'
      action_text = 'book open';
    }
    // Greeting / Morning -> wave
    else if (lowerText.includes('good morning') || lowerText.includes('morning')) {
      action_text = 'stretches and smiles';
    } 
    else if (lowerText.includes('hello') || lowerText.includes('hi ') || lowerText.match(/^hi$/)) {
      action_text = 'wave';
    } 
    // Sleep / Night -> sleep
    else if (lowerText.includes('good night') || lowerText.includes('sleep') || lowerText.includes('tired')) {
      action_text = 'sleep';
    }
    // Happy Birthday
    else if (lowerText.includes('happy birthday')) {
      action_text = 'happy birthday';
    }
    else if (lowerText.includes('happy yesterday')) {
      action_text = 'happy yesterday';
    }
    // Happy / Excited -> celebrate or happy
    else if (lowerText.includes('great') || lowerText.includes('awesome') || lowerText.includes('happy')) {
      action_text = 'happy';
    }
    // How are you -> gesturing
    else if (lowerText.includes('how are you') || lowerText.includes('what is up')) {
      action_text = 'gesturing';
    }
    else if (lowerText.includes('eat') || lowerText.includes('hungry') || lowerText.includes('food') || lowerText.includes('breakfast') || lowerText.includes('lunch') || lowerText.includes('dinner')) {
      action_text = 'eat';
    }
    else if (lowerText.includes('sad') || lowerText.includes('bad') || lowerText.includes('sorry')) {
      action_text = 'sad';
    }
    else if (lowerText.includes('angry') || lowerText.includes('mad') || lowerText.includes('furious')) {
      action_text = 'angry';
    }
    // Generic work/job (NOT study — that is handled above)
    else if (lowerText.includes('work') || lowerText.includes('job')) {
      action_text = 'desk_work';
    }
    else if (lowerText.includes('dance') || lowerText.includes('party') || lowerText.includes('music')) {
      action_text = 'dance';
    }

    // 2. Generate animation GIF for ALL users
    const ANIM_URL = process.env.ANIMATION_SERVICE_URL || 'http://localhost:8000';
    console.log('🎬 Calling animation service at:', `${ANIM_URL}/api/animate`, 'with text:', action_text);
    try {
      const animationRes = await axios.post(
        `${ANIM_URL}/api/animate`,
        { action: action_text },
        { responseType: 'arraybuffer', timeout: 300000 } // 5 minutes (generation can be slow)
      );
      const gifFilename = `anim_${Date.now()}.gif`;
      const publicGifPath = `uploads/${gifFilename}`;
      fs.writeFileSync(publicGifPath, Buffer.from(animationRes.data));
      const hostUrl = `${req.protocol}://${req.get('host')}`;
      gifData = `${hostUrl}/uploads/${gifFilename}`;
      console.log('✅ Animation generated and saved:', publicGifPath);
    } catch (err) {
      // Log the full error — common cause: Python server not running
      if (err.code === 'ECONNREFUSED') {
        console.error('❌ Animation service is NOT running at', ANIM_URL, '— start your Python server!');
      } else {
        console.error('❌ Animation Service Error:', err.response?.status, err.response?.data || err.message);
      }
      // Message still gets saved — just without GIF
    }

    // 4. Save message to MongoDB — voice messages are stored as text (no audioUrl)
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      type: 'text',   // always 'text' — voice is transcribed before this point
      text: final_text,
      gifUrl: gifData,
      audioUrl: null, // voice audio is never persisted
    });
    await newMessage.save();
    console.log('💾 Message saved:', newMessage._id, '| text:', final_text, '| hasGif:', !!gifData);

    // 5. Broadcast via Socket.io to receiver's room
    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: newMessage._id,
        sender: senderId,
        receiver: receiverId,
        text: final_text,
        type,
        gifUrl: gifData,
        audioUrl: null,
        createdAt: newMessage.createdAt,
      };
      io.to(receiverId).emit('receive_message', payload);
    }

    // 6. Return saved message to sender
    res.status(201).json({ ...newMessage.toObject(), gifUrl: gifData, audioUrl: null });

  } catch (err) {
    console.error('❌ sendMessage fatal error:', err.message, err.stack);
    res.status(500).json({ message: 'Failed to send message', error: err.message });
  }
};

// Get Messages between two users
exports.getMessages = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const myId = req.user.id;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherUserId },
        { sender: otherUserId, receiver: myId },
      ],
    }).sort('createdAt');

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
};
