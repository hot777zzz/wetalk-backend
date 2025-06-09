import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupData } from './group.dto/group.interface';
import { CreateGroupDto } from './group.dto/group.dto';
import { UserService } from '../user/user.service';
import {
  MemberInfoDto,
  GroupWithMembersDto,
} from './group.dto/member-info.dto';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectModel('Group') private readonly groupModel: Model<Group>,
    private readonly userService: UserService,
  ) {}

  // 根据ID查找群组
  async findGroupById(groupId: string): Promise<Group | null> {
    try {
      if (!Types.ObjectId.isValid(groupId)) {
        return null;
      }
      return await this.groupModel.findById(new Types.ObjectId(groupId)).exec();
    } catch (error: unknown) {
      this.logger.error(
        `查找群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return null;
    }
  }

  // 检查用户是否在群组中
  async isUserInGroup(userId: string, groupId: string): Promise<boolean> {
    try {
      if (!Types.ObjectId.isValid(groupId)) {
        return false;
      }
      const group = await this.groupModel
        .findOne({
          _id: new Types.ObjectId(groupId),
          members: userId,
        })
        .exec();
      return !!group;
    } catch (error: unknown) {
      this.logger.error(
        `检查用户群组成员身份失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return false;
    }
  }

  // 创建新群组
  async createGroup(createGroupDto: CreateGroupDto): Promise<Group> {
    try {
      // 生成唯一的groupId
      const groupId = new Date().getTime().toString();

      // 将groupId添加到DTO中
      const groupWithId = {
        ...createGroupDto,
        groupId: groupId,
      };

      const newGroup = new this.groupModel(groupWithId);

      // 确保创建者也是成员
      if (!newGroup.members.includes(createGroupDto.owner)) {
        newGroup.members.push(createGroupDto.owner);
      }

      return await newGroup.save();
    } catch (error: unknown) {
      this.logger.error(
        `创建群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取所有群组
  async findAll(): Promise<Group[]> {
    try {
      return await this.groupModel.find().exec();
    } catch (error: unknown) {
      this.logger.error(
        `获取所有群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取单个群组
  async findOne(groupId: string): Promise<Group> {
    try {
      const group = await this.groupModel.findById(groupId).exec();
      if (!group) {
        throw new NotFoundException(`群组ID ${groupId} 不存在`);
      }
      return group;
    } catch (error: unknown) {
      this.logger.error(
        `获取群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取用户的所有群组
  async findUserGroups(userId: string): Promise<GroupData[]> {
    try {
      const groups = await this.groupModel
        .find({
          members: userId,
        })
        .lean()
        .exec();

      return groups.map((group) => ({
        ...group,
        _id: group._id as Types.ObjectId,
      }));
    } catch (error: unknown) {
      this.logger.error(
        `获取用户群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 删除群组
  async deleteGroup(groupId: string, userId: string): Promise<boolean> {
    try {
      const group = await this.findOne(groupId);

      // 检查用户是否是群主
      if (group.owner !== userId) {
        throw new ForbiddenException('只有群主可以删除群组');
      }

      const result = await this.groupModel.deleteOne({ _id: groupId }).exec();
      if (result.deletedCount === 0) {
        throw new NotFoundException(`群组ID ${groupId} 不存在`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `删除群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 添加成员
  async addMember(
    groupId: string,
    userId: string,
    newMemberId: string,
  ): Promise<Group> {
    try {
      const group = await this.findOne(groupId);

      // 检查是否已经是群成员
      if (group.members.includes(newMemberId)) {
        throw new BadRequestException('用户已经是群成员');
      }

      // 添加新成员
      const updatedGroup = await this.groupModel
        .findByIdAndUpdate(
          groupId,
          {
            $push: { members: newMemberId },
            updatedAt: new Date(),
          },
          { new: true },
        )
        .exec();

      // 添加空检查
      if (!updatedGroup) {
        throw new NotFoundException(`群组ID ${groupId} 不存在`);
      }

      return updatedGroup;
    } catch (error: unknown) {
      this.logger.error(
        `添加群成员失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 移除成员
  async removeMember(
    groupId: string,
    userId: string,
    memberId: string,
  ): Promise<Group> {
    try {
      const group = await this.findOne(groupId);

      // 检查要移除的用户是否是群主
      if (memberId === group.owner) {
        throw new BadRequestException('无法移除群主');
      }

      // 检查操作者是否有权限（群主可以移除任何人，成员只能自己退出）
      if (userId !== group.owner && userId !== memberId) {
        throw new ForbiddenException('没有权限移除其他成员');
      }

      // 移除成员
      const updatedGroup = await this.groupModel
        .findByIdAndUpdate(
          groupId,
          {
            $pull: { members: memberId },
            updatedAt: new Date(),
          },
          { new: true },
        )
        .exec();

      // 添加空检查
      if (!updatedGroup) {
        throw new NotFoundException(`群组ID ${groupId} 不存在`);
      }

      return updatedGroup;
    } catch (error: unknown) {
      this.logger.error(
        `移除群成员失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 转让群主
  async transferOwnership(
    groupId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<Group> {
    try {
      const group = await this.findOne(groupId);

      // 验证当前操作者是否是群主
      if (group.owner !== currentOwnerId) {
        throw new ForbiddenException('只有群主可以转让群主权限');
      }

      // 检查新群主是否是群成员
      if (!group.members.includes(newOwnerId)) {
        throw new BadRequestException('新群主必须是群成员');
      }

      // 转让群主
      const updatedGroup = await this.groupModel
        .findByIdAndUpdate(
          groupId,
          {
            owner: newOwnerId,
            updatedAt: new Date(),
          },
          { new: true },
        )
        .exec();

      // 添加空检查
      if (!updatedGroup) {
        throw new NotFoundException(`群组ID ${groupId} 不存在`);
      }

      return updatedGroup;
    } catch (error: unknown) {
      this.logger.error(
        `转让群主失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 修改获取单个群组的方法
  async findOneWithMemberDetails(
    groupId: string,
  ): Promise<GroupWithMembersDto> {
    try {
      const group = await this.findOne(groupId);

      // 获取成员详细信息
      const membersInfo: MemberInfoDto[] = [];
      let ownerInfo: MemberInfoDto | undefined;

      // 获取所有成员信息（包括群主）
      for (const memberId of group.members) {
        try {
          const user = await this.userService.findById(memberId);
          if (user) {
            const memberInfo: MemberInfoDto = {
              _id: user._id.toString(),
              user_name: user.user_name,
              avatar: (user as any)?.avatar || '',
            };

            membersInfo.push(memberInfo);

            // 如果是群主，同时保存群主信息
            if (memberId === group.owner) {
              ownerInfo = memberInfo;
            }
          }
        } catch (error) {
          this.logger.warn(
            `无法获取成员信息 ${memberId}: ${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

      // 如果群主不在成员列表中，单独获取群主信息
      if (!ownerInfo) {
        try {
          const owner = await this.userService.findById(group.owner);
          if (owner) {
            ownerInfo = {
              _id: owner._id.toString(),
              user_name: owner.user_name,
              avatar: (owner as any)?.avatar || '',
            };
          }
        } catch (error) {
          this.logger.warn(
            `无法获取群主信息 ${group.owner}: ${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

      // 构建返回对象
      return {
        _id: (group._id as any).toString(),
        name: group.name,
        description: group.description,
        owner: group.owner,
        ownerInfo,
        members: group.members,
        membersInfo,
        avatar: group.avatar,
      };
    } catch (error: unknown) {
      this.logger.error(
        `获取群组详情失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }
}
