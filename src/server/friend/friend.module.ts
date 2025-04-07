import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { friendRequestSchema } from './dto/friend.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'FriendRequest', schema: friendRequestSchema },
    ]),
    UserModule,
  ],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
