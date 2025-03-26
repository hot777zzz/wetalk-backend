import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { messageSchema } from './message.dto/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Message', schema: messageSchema }]),
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
