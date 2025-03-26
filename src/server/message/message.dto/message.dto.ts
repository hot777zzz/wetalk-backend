export class CreateMessageDto {
  content: string;
  sender: string;
  receiver?: string;
  roomId?: string;
  messageType: 'private' | 'room';
  createdAt?: Date;
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
}
