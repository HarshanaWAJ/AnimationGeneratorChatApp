const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
  searchUsers, 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest,
  getFriends,
  removeFriend,
  getPendingRequests
} = require('../controllers/userController');
const { sendMessage, getMessages } = require('../controllers/messageController');
const multer = require('multer');

// Setup Multer for audio uploads
const upload = multer({ dest: 'uploads/' });

// --- User Routes ---
router.get('/search', auth, searchUsers);
router.get('/friends', auth, getFriends);
router.get('/pending-requests', auth, getPendingRequests);
router.post('/friend-request', auth, sendFriendRequest);
router.post('/accept-request', auth, acceptFriendRequest);
router.post('/reject-request', auth, rejectFriendRequest);
router.post('/remove-friend', auth, removeFriend);

// --- Message Routes ---
router.post('/send', auth, upload.single('audio'), sendMessage);
router.get('/:otherUserId', auth, getMessages);

module.exports = router;
