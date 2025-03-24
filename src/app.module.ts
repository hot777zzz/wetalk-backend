import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  // 填写本地的数据库路径
  imports: [MongooseModule.forRoot('mongodb://localhost:27017/mongodb')],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
