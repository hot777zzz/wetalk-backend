import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FriendRequest } from './dto/friend.interface';
import {
  CreateFriendRequestDto,
  UpdateFriendRequestDto,
  FriendRequestResponseDto,
  FriendDto,
} from './dto/friend.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class FriendService {
  private readonly logger = new Logger(FriendService.name);

  constructor(
    @InjectModel('FriendRequest')
    private readonly friendRequestModel: Model<FriendRequest>,
    private readonly userService: UserService,
  ) {}

  // 发送好友请求
  async createFriendRequest(
    senderId: string,
    createFriendRequestDto: CreateFriendRequestDto,
  ): Promise<FriendRequest> {
    try {
      const { receiverId } = createFriendRequestDto;

      // 检查是否向自己发送请求
      if (senderId === receiverId) {
        throw new BadRequestException('不能向自己发送好友请求');
      }

      // 检查接收者是否存在
      const receiver = await this.userService.findById(receiverId);
      if (!receiver) {
        throw new NotFoundException('接收者不存在');
      }

      // 检查是否已经是好友
      const existingAcceptedRequest = await this.friendRequestModel
        .findOne({
          $or: [
            { sender: senderId, receiver: receiverId, status: 'accepted' },
            { sender: receiverId, receiver: senderId, status: 'accepted' },
          ],
        })
        .exec();

      if (existingAcceptedRequest) {
        throw new ConflictException('已经是好友关系');
      }

      // 检查是否已经有待处理的请求
      const existingPendingRequest = await this.friendRequestModel
        .findOne({
          $or: [
            { sender: senderId, receiver: receiverId, status: 'pending' },
            { sender: receiverId, receiver: senderId, status: 'pending' },
          ],
        })
        .exec();

      if (existingPendingRequest) {
        // 如果对方已经发送了请求，自动接受
        if (existingPendingRequest.receiver === senderId) {
          return this.updateFriendRequest(
            existingPendingRequest._id?.toString() || existingPendingRequest.id,
            senderId,
            { status: 'accepted' },
          );
        }
        throw new ConflictException('已经发送过好友请求');
      }

      // 创建新的好友请求
      const newFriendRequest = new this.friendRequestModel({
        sender: senderId,
        receiver: receiverId,
      });

      return await newFriendRequest.save();
    } catch (error: unknown) {
      this.logger.error(
        `创建好友请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 更新好友请求状态
  async updateFriendRequest(
    requestId: string,
    userId: string,
    updateFriendRequestDto: UpdateFriendRequestDto,
  ): Promise<FriendRequest> {
    try {
      const friendRequest = await this.friendRequestModel
        .findById(requestId)
        .exec();

      if (!friendRequest) {
        throw new NotFoundException('好友请求不存在');
      }

      // 检查是否是接收者
      if (friendRequest.receiver !== userId) {
        throw new BadRequestException('只有接收者可以更新请求状态');
      }

      // 检查请求是否已经处理
      if (friendRequest.status !== 'pending') {
        throw new BadRequestException('该请求已经被处理');
      }

      // 更新状态
      const updatedFriendRequest = await this.friendRequestModel
        .findByIdAndUpdate(
          requestId,
          { status: updateFriendRequestDto.status },
          { new: true },
        )
        .exec();

      if (!updatedFriendRequest) {
        throw new NotFoundException('更新好友请求失败');
      }

      return updatedFriendRequest;
    } catch (error: unknown) {
      this.logger.error(
        `更新好友请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取用户收到的好友请求
  async getReceivedRequests(
    userId: string,
  ): Promise<FriendRequestResponseDto[]> {
    try {
      const requests = await this.friendRequestModel
        .find({ receiver: userId, status: 'pending' })
        .sort({ createdAt: -1 })
        .exec();

      return await this.populateRequestsWithUserInfo(requests);
    } catch (error: unknown) {
      this.logger.error(
        `获取收到的好友请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取用户发送的好友请求
  async getSentRequests(userId: string): Promise<FriendRequestResponseDto[]> {
    try {
      const requests = await this.friendRequestModel
        .find({ sender: userId })
        .sort({ createdAt: -1 })
        .exec();

      return await this.populateRequestsWithUserInfo(requests);
    } catch (error: unknown) {
      this.logger.error(
        `获取发送的好友请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取用户的好友列表
  async getFriendsList(userId: string): Promise<FriendDto[]> {
    try {
      // 查找所有已接受的好友请求
      const friendRequests = await this.friendRequestModel
        .find({
          $or: [{ sender: userId }, { receiver: userId }],
          status: 'accepted',
        })
        .exec();

      const friendIds = friendRequests.map((request) => {
        return request.sender === userId ? request.receiver : request.sender;
      });

      // 获取所有好友的详细信息
      const friends: FriendDto[] = [];
      for (const friendId of friendIds) {
        try {
          const user = await this.userService.findById(friendId);
          if (user) {
            friends.push({
              _id: user._id.toString(),
              user_name: user.user_name,
              avatar: (user as any)?.avatar || '',
            });
          }
        } catch (error) {
          this.logger.warn(
            `无法获取好友信息 ${friendId}: ${error instanceof Error ? error.message : '未知错误'}`,
          );
        }
      }

      return friends;
    } catch (error: unknown) {
      this.logger.error(
        `获取好友列表失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 删除好友关系
  async deleteFriend(userId: string, friendId: string): Promise<boolean> {
    try {
      // 查找并删除好友关系
      const result = await this.friendRequestModel
        .deleteOne({
          $or: [
            { sender: userId, receiver: friendId, status: 'accepted' },
            { sender: friendId, receiver: userId, status: 'accepted' },
          ],
        })
        .exec();

      if (result.deletedCount === 0) {
        throw new NotFoundException('好友关系不存在');
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `删除好友关系失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 辅助方法：为请求填充用户信息
  private async populateRequestsWithUserInfo(
    requests: FriendRequest[],
  ): Promise<FriendRequestResponseDto[]> {
    const populatedRequests: FriendRequestResponseDto[] = [];

    for (const request of requests) {
      try {
        const sender = await this.userService.findById(request.sender);
        const receiver = await this.userService.findById(request.receiver);

        populatedRequests.push({
          _id: request._id?.toString() || request.id,
          sender: request.sender,
          receiver: request.receiver,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          senderInfo: sender
            ? {
                _id: sender._id.toString(),
                user_name: sender.user_name,
                avatar: (sender as any)?.avatar || '',
              }
            : null,
          receiverInfo: receiver
            ? {
                _id: receiver._id.toString(),
                user_name: receiver.user_name,
                avatar: (receiver as any)?.avatar || '',
              }
            : null,
        });
      } catch (error) {
        this.logger.warn(
          `无法填充用户信息: ${error instanceof Error ? error.message : '未知错误'}`,
        );
      }
    }

    return populatedRequests;
  }
}
