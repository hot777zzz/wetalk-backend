import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDTO } from './user.dto';
import { User } from './user.interface';
@Injectable()
export class UserService {
  constructor(@InjectModel('Users') private readonly userModel: Model<User>) {}
  // 查找所有用户
  async findAll(): Promise<User[]> {
    const users = await this.userModel.find();
    return users;
  }
  // 查找单个用户
  async findOne(user_name: string): Promise<User> {
    const user = await this.userModel.findOne({ user_name });
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  }
  // 添加单个用户
  async addOne(body: CreateUserDTO): Promise<void> {
    await this.userModel.create(body);
  }
  // 编辑单个用户
  async updateOne(user_name: string, newPassword: string): Promise<void> {
    await this.userModel.updateOne({ user_name }, { password: newPassword });
  }
  // 删除单个用户
  async deleteOne(user_name: string): Promise<void> {
    await this.userModel.deleteOne({ user_name });
  }
}
