import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from './message.dto/message.interface';
import {
  CreateMessageDto,
  GetMessageQueryDto,
  UpdateMessageDto,
  MessageResponseDto,
} from './message.dto/message.dto';
import { UserService } from '../user/user.service';
import { GroupService } from '../group/group.service';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel('Message') private readonly messageModel: Model<Message>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => GroupService))
    private readonly groupService: GroupService,
  ) {}

  // 创建新消息
  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    try {
      // 填充发送者信息
      if (!createMessageDto.senderInfo) {
        const sender = await this.userService.findById(createMessageDto.sender);
        if (sender) {
          createMessageDto.senderInfo = {
            user_name: sender.user_name,
            avatar: (sender as any).avatar || '',
          };
        }
      }

      // 如果是私聊，填充接收者信息
      if (
        createMessageDto.messageType === 'private' &&
        createMessageDto.receiver &&
        !createMessageDto.receiverInfo
      ) {
        const receiver = await this.userService.findById(
          createMessageDto.receiver,
        );
        if (receiver) {
          createMessageDto.receiverInfo = {
            user_name: receiver.user_name,
            avatar: (receiver as any).avatar || '',
          };
        }
      }

      // 如果是群聊，填充群组信息
      if (
        createMessageDto.messageType === 'room' &&
        createMessageDto.roomId &&
        !createMessageDto.groupInfo
      ) {
        const group = await this.groupService.findOne(createMessageDto.roomId);
        if (group) {
          createMessageDto.groupInfo = {
            name: group.name,
            avatar: group.avatar || '',
          };
        }
      }

      const newMessage = new this.messageModel(createMessageDto);
      return await newMessage.save();
    } catch (error: unknown) {
      this.logger.error(
        `创建消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取私聊消息历史
  async getPrivateMessages(
    userId: string,
    otherUserId: string,
    limit = 50,
    skip = 0,
  ): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.messageModel
        .find({
          messageType: 'private',
          isDeleted: { $ne: true }, // 排除已删除消息
          $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // 标记对方发送的未读消息为已读
      await this.messageModel
        .updateMany(
          {
            messageType: 'private',
            sender: otherUserId,
            receiver: userId,
            readStatus: false,
          },
          { readStatus: true },
        )
        .exec();

      return messages.map((msg) => this.messageToResponseDto(msg));
    } catch (error: unknown) {
      this.logger.error(
        `获取私聊消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取群组消息历史
  async getGroupMessages(
    groupId: string,
    limit = 50,
    skip = 0,
    userId?: string, // 可选参数，用于标记某个用户的未读消息
  ): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.messageModel
        .find({
          groupId,
          messageType: 'group',
          isDeleted: { $ne: true }, // 排除已删除消息
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      // 如果提供了 userId，标记该用户的群组未读消息为已读
      if (userId) {
        // 这里可以实现基于用户的已读状态，需要更复杂的数据结构支持
        // 当前实现简单标记，生产环境中可能需要更精细的控制
      }

      return messages.map((msg) => this.messageToResponseDto(msg));
    } catch (error: unknown) {
      this.logger.error(
        `获取房间消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取公共消息历史
  async getPublicMessages(limit = 50, skip = 0): Promise<MessageResponseDto[]> {
    try {
      const messages = await this.messageModel
        .find({
          messageType: 'public',
          isDeleted: { $ne: true }, // 排除已删除消息
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      return messages.map((msg) => this.messageToResponseDto(msg));
    } catch (error: unknown) {
      this.logger.error(
        `获取公共消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 高级查询接口
  async queryMessages(
    query: GetMessageQueryDto,
  ): Promise<MessageResponseDto[]> {
    try {
      const filter: Record<string, any> = {
        isDeleted: { $ne: true }, // 默认排除已删除消息
      };

      // 如果指定了包含已删除消息
      if (query.includeDeleted) {
        delete filter.isDeleted;
      }

      if (query.messageType) {
        filter.messageType = query.messageType;
      }

      if (query.roomId) {
        filter.roomId = query.roomId;
      }

      if (query.sender && query.receiver) {
        filter.$or = [
          { sender: query.sender, receiver: query.receiver },
          { sender: query.receiver, receiver: query.sender },
        ];
      } else if (query.sender) {
        filter.sender = query.sender;
      } else if (query.receiver) {
        filter.receiver = query.receiver;
      }

      // 添加未读消息过滤条件
      if (query.unreadOnly) {
        filter.readStatus = false;
      }

      if (query.startDate || query.endDate) {
        filter.createdAt = {} as Record<string, Date>;
        if (query.startDate) {
          filter.createdAt.$gte = query.startDate;
        }
        if (query.endDate) {
          filter.createdAt.$lte = query.endDate;
        }
      }

      const messages = await this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip || 0)
        .limit(query.limit || 50)
        .exec();

      return messages.map((msg) => this.messageToResponseDto(msg));
    } catch (error: unknown) {
      this.logger.error(
        `查询消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 获取未读消息数量
  async getUnreadCount(
    userId: string,
    otherUserId?: string,
    roomId?: string,
  ): Promise<number> {
    try {
      const filter: Record<string, any> = {
        readStatus: false,
        isDeleted: { $ne: true },
      };

      if (otherUserId) {
        // 私聊未读消息
        filter.messageType = 'private';
        filter.sender = otherUserId;
        filter.receiver = userId;
      } else if (roomId) {
        // 群聊未读消息
        filter.messageType = 'room';
        filter.roomId = roomId;
        // 这里应该排除自己发的消息
        filter.sender = { $ne: userId };
      } else {
        // 所有未读消息
        filter.$or = [
          { messageType: 'private', receiver: userId },
          { messageType: 'room' },
        ];
        // 排除自己发的消息
        filter.sender = { $ne: userId };
      }

      return await this.messageModel.countDocuments(filter).exec();
    } catch (error: unknown) {
      this.logger.error(
        `获取未读消息数量失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 标记消息为已读
  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const result = await this.messageModel
        .updateOne({ _id: messageId }, { readStatus: true })
        .exec();

      return result.matchedCount > 0;
    } catch (error: unknown) {
      this.logger.error(
        `标记消息已读失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 标记对话的所有消息为已读
  async markConversationAsRead(
    userId: string,
    otherUserId?: string,
    roomId?: string,
  ): Promise<number> {
    try {
      const filter: Record<string, any> = {
        readStatus: false,
      };

      if (otherUserId) {
        // 私聊消息
        filter.messageType = 'private';
        filter.sender = otherUserId;
        filter.receiver = userId;
      } else if (roomId) {
        // 群聊消息
        filter.messageType = 'room';
        filter.roomId = roomId;
        filter.sender = { $ne: userId }; // 排除自己发的消息
      } else {
        return 0; // 没有指定具体对话，返回0
      }

      const result = await this.messageModel
        .updateMany(filter, { readStatus: true })
        .exec();

      return result.matchedCount;
    } catch (error: unknown) {
      this.logger.error(
        `标记对话已读失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 更新消息状态
  async updateMessageStatus(
    messageId: string,
    updates: UpdateMessageDto,
  ): Promise<Message> {
    try {
      const message = await this.messageModel
        .findByIdAndUpdate(messageId, updates, { new: true })
        .exec();

      if (!message) {
        throw new NotFoundException(`消息 ID ${messageId} 不存在`);
      }

      return message;
    } catch (error: unknown) {
      this.logger.error(
        `更新消息状态失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 软删除消息（将消息标记为已删除而不是实际删除）
  async softDeleteMessage(messageId: string): Promise<boolean> {
    try {
      const result = await this.messageModel
        .updateOne({ _id: messageId }, { isDeleted: true })
        .exec();

      if (result.matchedCount === 0) {
        throw new NotFoundException(`消息 ID ${messageId} 不存在`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `软删除消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 根据ID删除单个消息（硬删除）
  async deleteMessageById(messageId: string): Promise<boolean> {
    try {
      const result = await this.messageModel
        .deleteOne({
          _id: messageId,
        })
        .exec();

      if (result.deletedCount === 0) {
        throw new NotFoundException(`消息 ID ${messageId} 不存在`);
      }

      return true;
    } catch (error: unknown) {
      this.logger.error(
        `删除消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 删除公共消息历史
  async deletePublicMessages(): Promise<{ deleted: number }> {
    try {
      const result = await this.messageModel
        .deleteMany({
          messageType: 'public',
        })
        .exec();

      this.logger.log(`删除了 ${result.deletedCount} 条公共消息`);
      return { deleted: result.deletedCount };
    } catch (error: unknown) {
      this.logger.error(
        `删除公共消息失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw error;
    }
  }

  // 辅助方法：将消息对象转换为响应DTO
  private messageToResponseDto(message: Message): MessageResponseDto {
    return {
      _id: message._id?.toString() || '',
      content: message.content,
      sender: message.sender,
      receiver: message.receiver,
      roomId: message.roomId,
      messageType: message.messageType,
      createdAt: message.createdAt,
      senderInfo: message.senderInfo,
      receiverInfo: message.receiverInfo,
      groupInfo: message.groupInfo,
      readStatus: message.readStatus,
      isDeleted: message.isDeleted,
    };
  }
}
