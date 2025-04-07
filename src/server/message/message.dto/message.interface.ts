import { Document } from 'mongoose';

export interface Message extends Document {
  content: string; // 消息内容
  sender: string; // 发送者ID
  receiver?: string; // 接收者ID（私聊）
  roomId?: string; // 房间ID（群聊）
  messageType: string; // 消息类型：'private', 'room', 'public'
  createdAt: Date; // 创建时间
  senderInfo?: {
    user_name?: string;
    avatar?: string;
  }; // 发送者信息（可选，用于消息显示）
  receiverInfo?: {
    user_name?: string;
    avatar?: string;
  }; // 接收者信息（可选，用于消息显示）
  groupInfo?: {
    name?: string;
    avatar?: string;
  }; // 群组信息（可选，用于消息显示）
  readStatus?: boolean; // 是否已读
  isDeleted?: boolean; // 是否已删除（软删除）
}
