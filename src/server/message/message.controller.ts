import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetMessageQueryDto } from './message.dto/message.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // 获取私聊消息历史
  @Get('private/:otherUserId')
  async getPrivateMessages(
    @Request() req,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const userId = req.user.userId;
    const messages = await this.messageService.getPrivateMessages(
      userId,
      otherUserId,
      limit ? parseInt(limit.toString()) : 50,
      skip ? parseInt(skip.toString()) : 0,
    );
    return { messages };
  }

  // 获取房间消息历史
  @Get('room/:roomId')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const messages = await this.messageService.getRoomMessages(
      roomId,
      limit ? parseInt(limit.toString()) : 50,
      skip ? parseInt(skip.toString()) : 0,
    );
    return { messages };
  }

  // 高级查询接口
  @Get()
  async queryMessages(@Query() query: GetMessageQueryDto) {
    const messages = await this.messageService.queryMessages(query);
    return { messages };
  }

  // 删除单个消息
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Param('id') id: string) {
    await this.messageService.deleteMessageById(id);
    return { message: '消息删除成功' };
  }
}
