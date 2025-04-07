export class CreateFriendRequestDto {
  receiverId: string; // 接收者ID
}

export class UpdateFriendRequestDto {
  status: 'accepted' | 'rejected'; // 更新状态
}

export class FriendRequestResponseDto {
  _id: string;
  sender: string;
  receiver: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  senderInfo?: any; // 发送者信息
  receiverInfo?: any; // 接收者信息
}

export class FriendDto {
  _id: string;
  user_name: string;
  avatar: string;
  status?: string; // 在线状态
}
