export class CreateMessageDto {
  content: string;
  sender: string;
  receiver?: string;
  roomId?: string;
  messageType: 'private' | 'room';
  createdAt?: Date;
  senderInfo?: {
    user_name?: string;
    avatar?: string;
  };
  receiverInfo?: {
    user_name?: string;
    avatar?: string;
  };
  groupInfo?: {
    name?: string;
    avatar?: string;
  };
  readStatus?: boolean;
}

export class GetMessageQueryDto {
  sender?: string;
  receiver?: string;
  roomId?: string;
  messageType?: 'private' | 'room';
  limit?: number;
  skip?: number;
  startDate?: Date;
  endDate?: Date;
  unreadOnly?: boolean;
  includeDeleted?: boolean;
}

export class UpdateMessageDto {
  readStatus?: boolean;
  isDeleted?: boolean;
}

// 用于返回消息的DTO，包含关联信息
export class MessageResponseDto {
  _id: string;
  content: string;
  sender: string;
  receiver?: string;
  roomId?: string;
  messageType: string;
  createdAt: Date;
  senderInfo?: {
    user_name?: string;
    avatar?: string;
  };
  receiverInfo?: {
    user_name?: string;
    avatar?: string;
  };
  groupInfo?: {
    name?: string;
    avatar?: string;
  };
  readStatus?: boolean;
  isDeleted?: boolean;
}
