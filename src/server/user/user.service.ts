import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { User } from './user.dto/user.interface';
import { CreateUserDTO, EditUserDTO } from './user.dto/user.dto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import * as bcryptjs from 'bcryptjs';
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

  async findAll(): Promise<User[]> {
    return await this.userModel.find().exec();
  }

  async findOne(userName: string): Promise<User> {
    const user = await this.userModel.findOne({ user_name: userName }).exec();
    if (!user) {
      throw new NotFoundException(`用户 ${userName} 不存在`);
    }
    return user;
  }

  async addOne(userData: CreateUserDTO): Promise<User> {
    // 检查用户是否已存在
    try {
      await this.findOne(userData.user_name);
      throw new ConflictException(`用户名 ${userData.user_name} 已被使用`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        // 用户不存在，可以创建
        // 创建一个新对象而不是修改原对象
        const newUserData = {
          ...userData,
        };

        // 创建并返回新用户
        const newUser = new this.userModel(newUserData);
        return await newUser.save();
      }
      throw error;
    }
  }

  // 编辑单个用户
  async updateOne(body: EditUserDTO): Promise<User> {
    if (!body.user_name) {
      throw new BadRequestException('用户名不能为空');
    }

    // 如果要更新密码，需要加密
    const updateData = { ...body };
    if (updateData.password) {
      updateData.password = bcryptjs.hashSync(updateData.password, 10);
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate({ user_name: body.user_name }, updateData, {
        new: true,
      })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`用户 ${body.user_name} 不存在`);
    }

    return updatedUser;
  }

  // 删除单个用户
  async deleteOne(userName: string): Promise<void> {
    const result = await this.userModel
      .deleteOne({ user_name: userName })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`用户 ${userName} 不存在`);
    }
  }

  /**
   * 更新用户密码
   * @param username 用户名
   * @param newPassword 新密码（已哈希）
   * @returns 更新结果
   */
  async updatePassword(username: string, newPassword: string) {
    const result = await this.userModel
      .updateOne({ user_name: username }, { password: newPassword })
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException(`用户 ${username} 不存在`);
    }

    return { success: true };
  }

  // 添加按ID查找用户的方法
  async findById(userId: string): Promise<User | null> {
    try {
      return await this.userModel.findById(userId).exec();
    } catch (error: unknown) {
      this.logger.error(
        `按ID查找用户失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return null;
    }
  }
}
