import { Schema } from 'mongoose';

export const groupSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  owner: { type: String, required: true }, // 群主ID
  members: { type: [String], default: [] }, // 成员ID列表
  avatar: { type: String, default: '' }, // 群头像
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// 添加更新前的中间件来处理更新时间
groupSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
