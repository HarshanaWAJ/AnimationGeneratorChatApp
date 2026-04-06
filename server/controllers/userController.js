const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

// Search users by email or username
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: 'Search query is required' });

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user.id } // Exclude self
    }).select('-password').lean();

    // Add status to each user
    const userWithStatus = await Promise.all(users.map(async (u) => {
      const isFriend = await User.findOne({ _id: req.user.id, friends: u._id });
      const pendingRequest = await FriendRequest.findOne({
        $or: [
          { sender: req.user.id, receiver: u._id, status: 'pending' },
          { sender: u._id, receiver: req.user.id, status: 'pending' }
        ]
      });

      return {
        ...u,
        status: isFriend ? 'friend' : (pendingRequest ? 'pending' : 'none')
      };
    }));

    res.status(200).json(userWithStatus);
  } catch (err) {
    res.status(500).json({ message: 'Error searching users', error: err.message });
  }
};

// Send Friend Request
exports.sendFriendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (senderId === receiverId) return res.status(400).json({ message: 'Cannot add yourself' });

    // Check if request already exists
    const existing = await FriendRequest.findOne({ sender: senderId, receiver: receiverId });
    if (existing) return res.status(400).json({ message: 'Request already sent' });

    const request = new FriendRequest({ sender: senderId, receiver: receiverId });
    await request.save();

    res.status(201).json({ message: 'Friend request sent successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending friend request', error: err.message });
  }
};

// Accept Friend Request
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);

    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = 'accepted';
    await request.save();

    // Add friends to both users
    await User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } });
    await User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } });

    res.status(200).json({ message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ message: 'Error accepting friend request', error: err.message });
  }
};

// Get Friends List
exports.getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('friends', 'username email avatar');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user.friends);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching friends', error: err.message });
  }
};

// Reject Friend Request
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);

    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ message: 'Friend request rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Error rejecting friend request', error: err.message });
  }
};

// Remove Friend
exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;

    // Remove from both users
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

    // Also delete any existing friend requests between them
    await FriendRequest.deleteMany({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId }
      ]
    });

    res.status(200).json({ message: 'Friend removed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing friend', error: err.message });
  }
};

// Get Pending Friend Requests
exports.getPendingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user.id,
      status: 'pending'
    }).populate('sender', 'username email avatar');

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending requests', error: err.message });
  }
};
