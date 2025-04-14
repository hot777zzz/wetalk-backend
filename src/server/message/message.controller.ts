import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Request,
  Delete,
  HttpCode,
  HttpStatus,
  Body,
  Patch,
} from '@nestjs/common';
import { MessageService } from './message.service';
import {
  GetMessageQueryDto,
  UpdateMessageDto,
  CreateMessageDto,
} from './message.dto/message.dto';

@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // 创建新消息（手动创建，通常通过WebSocket自动创建）
  @Post()
  async createMessage(
    @Body() createMessageDto: CreateMessageDto,
    @Request() req,
  ) {
    const userId = req.user.userId;
    // 确保发送者为当前登录用户
    createMessageDto.sender = userId;

    const message = await this.messageService.createMessage(createMessageDto);
    return { message };
  }

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

  // 获取群组消息历史
  @Get('group/:groupId')
  async getGroupMessages(
    @Request() req,
    @Param('groupId') groupId: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const userId = req.user.userId;
    const messages = await this.messageService.getGroupMessages(
      groupId,
      limit ? parseInt(limit.toString()) : 50,
      skip ? parseInt(skip.toString()) : 0,
      userId, // 传入用户ID以便标记已读
    );
    return { messages };
  }

  // 获取未读消息数量
  @Get('unread/count')
  async getUnreadCount(
    @Request() req,
    @Query('otherUserId') otherUserId?: string,
    @Query('groupId') groupId?: string,
  ) {
    const userId = req.user.userId;
    const count = await this.messageService.getUnreadCount(
      userId,
      otherUserId,
      groupId,
    );
    return { count };
  }

  // 标记消息为已读
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string) {
    const success = await this.messageService.markAsRead(id);
    return { success };
  }

  // 标记整个对话为已读
  @Patch('conversation/read')
  @HttpCode(HttpStatus.OK)
  async markConversationAsRead(
    @Request() req,
    @Query('otherUserId') otherUserId?: string,
    @Query('groupId') groupId?: string,
  ) {
    const userId = req.user.userId;
    const count = await this.messageService.markConversationAsRead(
      userId,
      otherUserId,
      groupId,
    );
    return { count };
  }

  // 更新消息状态
  @Put(':id')
  async updateMessage(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req,
  ) {
    const message = await this.messageService.updateMessageStatus(
      id,
      updateMessageDto,
    );
    return { message };
  }

  // 软删除消息
  @Delete(':id/soft')
  @HttpCode(HttpStatus.OK)
  async softDeleteMessage(@Param('id') id: string) {
    const success = await this.messageService.softDeleteMessage(id);
    return { success, message: '消息已软删除' };
  }

  // 高级查询接口
  @Get()
  async queryMessages(@Query() query: GetMessageQueryDto) {
    const messages = await this.messageService.queryMessages(query);
    return { messages };
  }

  // 删除单个消息（硬删除）
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Param('id') id: string) {
    await this.messageService.deleteMessageById(id);
    return { message: '消息删除成功' };
  }
}
