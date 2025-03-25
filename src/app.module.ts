import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './server/user/user.module';
import { AuthModule } from './server/auth/auth.module';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EventGateway } from './gateway/event.gateway';
@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/mongodb'),
    UserModule,
    AuthModule,
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
