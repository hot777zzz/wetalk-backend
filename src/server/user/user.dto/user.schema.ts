// user.schema.ts
import { Schema } from 'mongoose';

export const userSchema = new Schema(
  {
    // 移除 _id 定义，让 MongoDB 自动处理
    user_name: { type: String, required: true }, // 用户名
    password: { type: String, required: true }, // 密码
    company: { type: String, required: false }, // 公司
    email: { type: String, required: false }, // 邮箱
    phone: { type: String, required: false }, // 电话
    address: { type: String, required: false }, // 地址
    position: { type: String, required: false }, // 职位
    birth_date: { type: Date, required: false }, // 生日
    note: { type: String, required: false }, // 备注
    created_at: { type: Date, default: Date.now }, // 创建时间
    updated_at: { type: Date, default: Date.now }, // 更新时间
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, // 自动管理时间戳
  },
);

// 添加更新前的中间件来处理更新时间
userSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});
