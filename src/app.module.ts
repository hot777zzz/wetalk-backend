import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './server/user/user.module';
import { AuthModule } from './server/auth/auth.module';
import { MessageModule } from './server/message/message.module';
import { GroupModule } from './server/group/group.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EventGateway } from './gateway/event.gateway';
import { FriendModule } from './server/friend/friend.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/mongodb'),
    UserModule,
    AuthModule,
    MessageModule,
    GroupModule,
    FriendModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    EventGateway,
  ],
})
export class AppModule {}
