import { Document } from 'mongoose';

export interface Message extends Document {
  content: string; // 消息内容
  sender: string; // 发送者ID
  receiver?: string; // 接收者ID（私聊）
  roomId?: string; // 房间ID（群聊）
  messageType: string; // 消息类型：'private', 'room', 'public'
  createdAt: Date; // 创建时间
}
