import {
  Controller,
  Body,
  // Delete,
  Get,
  Post,
} from '@nestjs/common';
import { CreateUserDTO } from './user.dto';
import { User } from './user.interface';
import { UserService } from './user.service';
interface UserResponse<T = unknown> {
  //这是一个 TypeScript 接口定义，用于描述用户响应的数据结构。它包含一个泛型参数 T，默认值为 unknown，其中包含 code（响应码）、data（响应数据，可选）和 message（响应消息）三个属性。
  code: number;
  data?: T;
  message: string;
}
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  // GET /user/users
  @Get('/users')
  async findAll(): Promise<UserResponse<User[]>> {
    return {
      code: 200,
      data: await this.userService.findAll(),
      message: '查询成功.',
    };
  }
  // GET /user/:_id
  @Post('/find_one')
  async findOne(
    @Body() userData: { user_name: string },
  ): Promise<UserResponse> {
    await this.userService.findOne(userData.user_name); // 使用传入的 user_name 参数
    return {
      code: 200,
      data: await this.userService.findOne(userData.user_name),
      message: '查询成功.',
    };
  }
  // POST /user/user
  @Post('/user')
  async addOne(@Body() body: CreateUserDTO): Promise<UserResponse> {
    await this.userService.addOne(body);
    return {
      code: 200,
      message: '添加成功.',
    };
  }
  // PUT /user/:_id
  @Post('/upd')
  async updateOne(
    @Body() userData: { user_name: string; newPassword: string },
  ): Promise<UserResponse> {
    await this.userService.updateOne(userData.user_name, userData.newPassword); // 使用传入的 user_name 参数
    return {
      code: 200,
      message: '修改成功.',
    };
  }
  // Post /user/deluser
  @Post('/deluser1')
  async deleteOne(
    @Body() userData: { user_name: string },
  ): Promise<UserResponse> {
    await this.userService.deleteOne(userData.user_name); // 使用传入的 user_name 参数
    return {
      code: 200,
      message: '删除成功.',
    };
  }
}
