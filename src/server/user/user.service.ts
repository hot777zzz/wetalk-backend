import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDTO, EditUserDTO } from './user.dto/user.dto';
import { User } from './user.dto/user.interface';
@Injectable()
export class UserService {
  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}
  // 查找所有用户
  async findAll(): Promise<User[]> {
    const users = await this.userModel.find();
    return users;
  }
  // 查找单个用户
  async findOne(userName: string): Promise<User> {
    const user = await this.userModel.findOne({ user_name: userName }).exec();
    if (!user) {
      throw new NotFoundException(`用户 ${userName} 不存在`);
    }
    return user;
  }
  // 添加单个用户
  async addOne(userData: CreateUserDTO): Promise<User> {
    // 检查用户是否已存在
    const existingUser = await this.userModel
      .findOne({ user_name: userData.user_name })
      .exec();
    if (existingUser) {
      throw new ConflictException(`用户名 ${userData.user_name} 已被使用`);
    }

    // 创建并返回新用户
    const newUser = new this.userModel(userData);
    return await newUser.save();
  }
  // 编辑单个用户
  async updateOne(body: EditUserDTO): Promise<User> {
    if (!body.user_name) {
      throw new BadRequestException('用户名不能为空');
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate({ user_name: body.user_name }, body, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`用户 ${body.user_name} 不存在`);
    }

    return updatedUser;
  }
  // 删除单个用户
  async deleteOne(user_name: string): Promise<void> {
    await this.userModel.deleteOne({ user_name });
  }
}
