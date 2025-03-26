import { Schema } from 'mongoose';

export const messageSchema = new Schema({
  content: { type: String, required: true },
  sender: { type: String, required: true },
  receiver: { type: String },
  roomId: { type: String },
  messageType: {
    type: String,
    required: true,
    enum: ['private', 'room'],
  },
  createdAt: { type: Date, default: Date.now },
});

// 创建复合索引以优化查询性能
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ roomId: 1 });
messageSchema.index({ createdAt: -1 });
