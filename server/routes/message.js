const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendMessage, getMessages } = require('../controllers/messageController');
const multer = require('multer');

// Setup Multer for audio uploads
const upload = multer({ dest: 'uploads/' });

// POST /api/messages/send  — send a text or voice message
router.post('/send', auth, upload.single('audio'), sendMessage);

// GET /api/messages/:otherUserId  — fetch conversation history
router.get('/:otherUserId', auth, getMessages);

module.exports = router;
