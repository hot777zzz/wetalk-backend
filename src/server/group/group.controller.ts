import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Request,
} from '@nestjs/common';
import { GroupService } from './group.service';

import { CreateGroupDto, AddMemberDto } from './group.dto/group.dto';
import { Public } from '../auth/constants';

// 请求类型定义
interface RequestWithUser extends Request {
  user: {
    userId: string;
    username: string;
  };
}

@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  // 创建群组
  @Post()
  async createGroup(
    @Body() createGroupDto: CreateGroupDto,
    @Request() req: RequestWithUser,
  ) {
    // 确保当前用户是创建者
    createGroupDto.owner = req.user.userId;

    // 添加唯一的groupId
    createGroupDto['groupId'] = new Date().getTime().toString();

    return this.groupService.createGroup(createGroupDto);
  }

  // 获取所有群组
  @Public()
  @Get()
  async getAllGroups() {
    return this.groupService.findAll();
  }

  // 获取当前用户的所有群组
  @Get('my-groups')
  async getMyGroups(@Request() req: RequestWithUser) {
    return this.groupService.findUserGroups(req.user.userId);
  }

  // 获取特定群组
  @Get(':id')
  async getGroup(@Param('id') id: string) {
    return this.groupService.findOneWithMemberDetails(id);
  }

  // 删除群组
  @Delete(':id')
  async deleteGroup(@Param('id') id: string, @Request() req: RequestWithUser) {
    await this.groupService.deleteGroup(id, req.user.userId);
    return { message: '群组删除成功' };
  }

  // 添加成员
  @Post(':id/members')
  async addMember(
    @Param('id') id: string,
    @Body() addMemberDto: AddMemberDto,
    @Request() req: RequestWithUser,
  ) {
    return this.groupService.addMember(
      id,
      req.user.userId,
      addMemberDto.userId,
    );
  }

  // 移除成员
  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.groupService.removeMember(id, req.user.userId, memberId);
  }

  // 退出群组（自己离开）
  @Post(':id/leave')
  async leaveGroup(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.groupService.removeMember(id, req.user.userId, req.user.userId);
  }

  // 转让群主
  @Put(':id/transfer-ownership/:newOwnerId')
  async transferOwnership(
    @Param('id') id: string,
    @Param('newOwnerId') newOwnerId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.groupService.transferOwnership(id, req.user.userId, newOwnerId);
  }
}
