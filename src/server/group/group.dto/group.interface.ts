import { Document } from 'mongoose';

export interface Group extends Document {
  readonly name: string;
  readonly description: string;
  readonly owner: string; // 群主ID
  readonly members: string[]; // 成员ID列表
  readonly avatar: string; // 群头像
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
