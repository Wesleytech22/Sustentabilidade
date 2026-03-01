const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  room: { type: String, default: 'geral' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  readAt: Date
}, { timestamps: true });

messageSchema.index({ room: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

messageSchema.statics.getRoomHistory = function(room, limit = 50) {
  return this.find({ room })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name email');
};

module.exports = mongoose.model('Message', messageSchema);