import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from './message.dto/message.interface';
import {
  CreateMessageDto,
  GetMessageQueryDto,
} from './message.dto/message.dto';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectModel('Message') private readonly messageModel: Model<Message>,
  ) {}

  // 创建新消息
  async createMessage(createMessageDto: CreateMessageDto): Promise<Message> {
    try {
      const newMessage = new this.messageModel(createMessageDto);
      return await newMessage.save();
    } catch (error) {
      this.logger.error(`创建消息失败: ${error.message}`);
      throw error;
    }
  }

  // 获取私聊消息历史
  async getPrivateMessages(
    userId: string,
    otherUserId: string,
    limit = 50,
    skip = 0,
  ): Promise<Message[]> {
    try {
      return await this.messageModel
        .find({
          messageType: 'private',
          $or: [
            { sender: userId, receiver: otherUserId },
            { sender: otherUserId, receiver: userId },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`获取私聊消息失败: ${error.message}`);
      throw error;
    }
  }

  // 获取房间消息历史
  async getRoomMessages(
    roomId: string,
    limit = 50,
    skip = 0,
  ): Promise<Message[]> {
    try {
      return await this.messageModel
        .find({
          roomId,
          messageType: 'room',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`获取房间消息失败: ${error.message}`);
      throw error;
    }
  }

  // 获取公共消息历史
  async getPublicMessages(limit = 50, skip = 0): Promise<Message[]> {
    try {
      return await this.messageModel
        .find({
          messageType: 'public',
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`获取公共消息失败: ${error.message}`);
      throw error;
    }
  }

  // 高级查询接口
  async queryMessages(query: GetMessageQueryDto): Promise<Message[]> {
    try {
      const filter: any = {};

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

      if (query.startDate || query.endDate) {
        filter.createdAt = {};
        if (query.startDate) {
          filter.createdAt.$gte = query.startDate;
        }
        if (query.endDate) {
          filter.createdAt.$lte = query.endDate;
        }
      }

      return await this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip || 0)
        .limit(query.limit || 50)
        .exec();
    } catch (error) {
      this.logger.error(`查询消息失败: ${error.message}`);
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
    } catch (error) {
      this.logger.error(`删除公共消息失败: ${error.message}`);
      throw error;
    }
  }

  // 根据ID删除单个消息
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
    } catch (error) {
      this.logger.error(`删除消息失败: ${error.message}`);
      throw error;
    }
  }
}
