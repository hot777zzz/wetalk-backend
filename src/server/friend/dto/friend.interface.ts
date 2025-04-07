import { Document } from 'mongoose';

export interface FriendRequest extends Document {
  readonly sender: string;
  readonly receiver: string;
  status: 'pending' | 'accepted' | 'rejected';
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
