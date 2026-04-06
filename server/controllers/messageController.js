const Message = require('../models/Message');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

// Send Message (Text or Voice)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, type, text: input_text } = req.body;
    const senderId = req.user.id;
    let final_text = input_text;
    let gifData = null; 
    let audioData = null;

    // 1. If voice, convert audio to text then DELETE
    if (type === 'voice' && req.file) {
      const audio_path = req.file.path;
      
      const transcribeData = new FormData();
      transcribeData.append('file', fs.createReadStream(audio_path));

      try {
        // 1a. Capture Audio as Base64 before deleting
        const audioBuffer = fs.readFileSync(audio_path);
        audioData = `data:audio/wav;base64,${audioBuffer.toString('base64')}`;

        const transcribeData = new FormData();
        transcribeData.append('file', fs.createReadStream(audio_path));

        const transcribeRes = await axios.post(`${process.env.ANIMATION_SERVICE_URL}/api/transcribe`, transcribeData, {
          headers: {
            ...transcribeData.getHeaders()
          }
        });
        final_text = transcribeRes.data.text;
      } catch (err) {
        console.error('Local STT Transcription Error:', err.message);
      } finally {
        // Ephemeral: Delete audio file immediately
        fs.unlink(audio_path, (err) => {
          if (err) console.error('Failed to delete temp audio:', err);
        });
      }
    }

    if (!final_text) return res.status(400).json({ message: 'No message content' });

    // 2. Call local Python Animation Service to get the GIF (Ephemeral)
    try {
      const animationRes = await axios.post(`${process.env.ANIMATION_SERVICE_URL}/api/animate`, {
        action: final_text
      }, { responseType: 'arraybuffer' });

      gifData = `data:image/gif;base64,${Buffer.from(animationRes.data).toString('base64')}`;
    } catch (err) {
      console.error('Animation Service Error:', err.message);
    }

    // 3. Save only Text to MongoDB
    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      type,
      text: final_text,
      gifUrl: gifData,
      audioUrl: audioData,
    });
    await newMessage.save();

    // 4. Broadcast Enriched Payload via Socket.io (Real-time only)
    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: newMessage._id,
        sender: senderId,
        receiver: receiverId,
        text: final_text,
        type,
        gifUrl: gifData, 
        audioUrl: audioData,
        createdAt: newMessage.createdAt
      };
      // Emit to the receiver's room
      io.to(receiverId).emit('receive_message', payload);
      // Also emit back to the sender for confirmation if needed (or just return in res)
    }

    res.status(201).json({ ...newMessage.toObject(), gifUrl: gifData });
  } catch (err) {
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
        { sender: otherUserId, receiver: myId }
      ]
    }).sort('createdAt');

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
};
