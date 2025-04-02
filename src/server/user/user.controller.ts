import { Controller, Body, Get, Post, Query, Request } from '@nestjs/common';
import { EditUserDTO } from './user.dto/user.dto';
import { User } from './user.dto/user.interface';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /user/users
  @Get('/users')
  async findAll(): Promise<User[]> {
    return await this.userService.findAll();
  }

  // GET /user/findOne
  @Get('/findOne')
  async findOne(@Query('user_name') userName: string): Promise<User> {
    return await this.userService.findOne(userName);
  }

  // GET /user/profile - 获取当前登录用户信息
  @Get('/profile')
  async getProfile(@Request() req): Promise<User> {
    return await this.userService.findOne(req.user.username);
  }

  // POST /user/upd
  @Post('/upd')
  async updateOne(@Body() body: EditUserDTO): Promise<User> {
    return await this.userService.updateOne(body);
  }

  // POST /user/del
  @Post('/del')
  async deleteOne(
    @Body() userData: { user_name: string },
  ): Promise<{ deleted: boolean }> {
    await this.userService.deleteOne(userData.user_name);
    return { deleted: true };
  }
}
