// user.schema.ts
import { Schema } from 'mongoose';

export const userSchema = new Schema({
  user_name: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 60 },
  avatar: { type: String, default: '' },
  email: { type: String, default: '' },
  role: { type: String, default: 'user' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// 添加更新前的中间件来处理更新时间
userSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});
