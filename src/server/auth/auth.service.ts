import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcryptjs from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { CreateUserDTO } from '../user/user.dto/user.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 8;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    try {
      const user = await this.userService.findOne(username);

      // 使用 bcryptjs 比较密码
      const isPasswordValid = bcryptjs.compareSync(password, user.password);

      if (isPasswordValid) {
        const { password: _, ...result } = user.toObject();
        return result;
      }
      return null;
    } catch (error: unknown) {
      this.logger.error(
        `验证用户失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      return null;
    }
  }

  async login(loginDto: LoginDto) {
    try {
      this.logger.debug(`尝试登录用户: ${loginDto.user_name}`);

      const user = await this.userService.findOne(loginDto.user_name);

      // 尝试标准验证
      const isPasswordValid = bcryptjs.compareSync(
        loginDto.password,
        user.password,
      );

      if (!isPasswordValid) {
        this.logger.warn(`用户 ${loginDto.user_name} 密码验证失败`);
        throw new UnauthorizedException('用户名或密码错误');
      }

      const payload = { username: user.user_name, sub: user._id };

      return {
        message: '登录成功',
        userId: user._id,
        username: user.user_name,
        token: this.jwtService.sign(payload),
      };
    } catch (error: unknown) {
      // 错误处理保持不变
      if (error instanceof NotFoundException) {
        this.logger.warn(`登录失败: 用户 ${loginDto.user_name} 不存在`);
        throw new UnauthorizedException('用户名或密码错误');
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `登录失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new UnauthorizedException('用户名或密码错误');
    }
  }

  async register(createUserDto: CreateUserDTO) {
    if (!createUserDto.user_name || !createUserDto.password) {
      throw new BadRequestException('用户名和密码不能为空');
    }

    try {
      // 检查用户是否已存在
      await this.userService.findOne(createUserDto.user_name);
      // 如果没有抛出异常，说明用户已存在
      throw new ConflictException('用户名已存在');
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }

      // 如果是 NotFoundException，说明用户不存在，可以创建
      if (error instanceof NotFoundException) {
        const newUserData = { ...createUserDto };

        const hashedPassword = bcryptjs.hashSync(
          newUserData.password,
          this.SALT_ROUNDS,
        );
        this.logger.debug(`加密后的密码: ${hashedPassword}`);

        newUserData.password = hashedPassword;

        // 创建用户
        const user = await this.userService.addOne(newUserData);

        // 创建成功后，生成 JWT token
        const payload = { username: user.user_name, sub: user._id };

        return {
          message: '注册成功',
          userId: user._id,
          username: user.user_name,
          token: this.jwtService.sign(payload),
        };
      }

      // 其他未知错误
      throw new Error('注册失败，请稍后重试');
    }
  }

  // 重置密码的方法
  async resetPassword(username: string, newPassword: string) {
    try {
      const user = await this.userService.findOne(username);

      // 使用 bcryptjs 加密新密码
      const hashedPassword = bcryptjs.hashSync(newPassword, this.SALT_ROUNDS);

      // 更新用户密码
      await this.userService.updatePassword(username, hashedPassword);

      return { message: '密码重置成功' };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`用户 ${username} 不存在`);
      }

      this.logger.error(
        `重置密码失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      throw new BadRequestException('重置密码失败');
    }
  }
}
