import { Module } from '@nestjs/common';
import { EventGateway } from './event.gateway';
import { UserModule } from '../server/user/user.module';
import { MessageModule } from '../server/message/message.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../server/auth/constants';

@Module({
  imports: [
    UserModule,
    MessageModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: jwtConstants.expiresIn },
    }),
  ],
  providers: [EventGateway],
  exports: [EventGateway],
})
export class GatewayModule {}
