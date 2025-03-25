import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDTO } from '../user/user.dto/user.dto';
import { Public } from './constants';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Req, Request } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  async register(@Body() createUserDto: CreateUserDTO) {
    return this.authService.register(createUserDto);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: { newPassword: string },
    @Req() request: Request,
  ) {
    const token = request.headers['authorization']?.toString().split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('未提供令牌');
    }

    try {
      const payload = this.jwtService.verify(token);
      const username: string = payload.username;

      return this.authService.resetPassword(
        username,
        resetPasswordDto.newPassword,
      );
    } catch (error) {
      throw new UnauthorizedException('无效的令牌');
    }
  }
}
