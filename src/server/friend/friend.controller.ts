import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Request,
  Put,
} from '@nestjs/common';
import { FriendService } from './friend.service';
import {
  CreateFriendRequestDto,
  UpdateFriendRequestDto,
} from './dto/friend.dto';

// 请求类型定义
interface RequestWithUser extends Request {
  user: {
    userId: string;
    username: string;
  };
}

@Controller('friends')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  // 发送好友请求
  @Post('requests')
  async createFriendRequest(
    @Body() createFriendRequestDto: CreateFriendRequestDto,
    @Request() req: RequestWithUser,
  ) {
    return this.friendService.createFriendRequest(
      req.user.userId,
      createFriendRequestDto,
    );
  }

  // 更新好友请求状态（接受/拒绝）
  @Put('requests/:id')
  async updateFriendRequest(
    @Param('id') id: string,
    @Body() updateFriendRequestDto: UpdateFriendRequestDto,
    @Request() req: RequestWithUser,
  ) {
    return this.friendService.updateFriendRequest(
      id,
      req.user.userId,
      updateFriendRequestDto,
    );
  }

  // 获取收到的好友请求
  @Get('requests/received')
  async getReceivedRequests(@Request() req: RequestWithUser) {
    return this.friendService.getReceivedRequests(req.user.userId);
  }

  // 获取发送的好友请求
  @Get('requests/sent')
  async getSentRequests(@Request() req: RequestWithUser) {
    return this.friendService.getSentRequests(req.user.userId);
  }

  // 获取好友列表
  @Get()
  async getFriendsList(@Request() req: RequestWithUser) {
    return this.friendService.getFriendsList(req.user.userId);
  }

  // 删除好友
  @Delete(':id')
  async deleteFriend(
    @Param('id') friendId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.friendService.deleteFriend(req.user.userId, friendId);
    return { message: '好友删除成功' };
  }
}
