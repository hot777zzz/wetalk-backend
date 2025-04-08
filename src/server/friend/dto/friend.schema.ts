import { Schema } from 'mongoose';

export const friendRequestSchema = new Schema({
  sender: { type: String, required: true }, // 发送者ID
  receiver: { type: String, required: true }, // 接收者ID
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

friendRequestSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
