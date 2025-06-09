import { Document, Types } from 'mongoose';

export interface Group extends Document {
  readonly _id: Types.ObjectId;
  readonly name: string;
  readonly description: string;
  readonly owner: string; // 群主ID
  readonly members: string[]; // 成员ID列表
  readonly avatar: string; // 群头像
  readonly groupId: string; // 添加groupId字段
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// 添加不包含Document的纯接口定义
export interface GroupData {
  readonly _id: Types.ObjectId;
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  readonly members: string[];
  readonly avatar: string;
  readonly groupId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
