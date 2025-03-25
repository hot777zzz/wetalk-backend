import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDTO } from '../user/user.dto/user.dto';
import { Public } from './constants';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

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

  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: { username: string; newPassword: string },
  ) {
    return this.authService.resetPassword(
      resetPasswordDto.username,
      resetPasswordDto.newPassword,
    );
  }

  @Public()
  @Post('temp-login')
  async tempLogin(@Body() loginDto: LoginDto) {
    return this.authService.tempLogin(loginDto);
  }
}
