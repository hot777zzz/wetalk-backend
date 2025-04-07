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

// 添加更新前的中间件来处理更新时间
friendRequestSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// 创建复合索引，确保同一对用户之间只有一个未处理的请求
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
