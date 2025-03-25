export const jwtConstants = {
  secret: 'wetalk-secret-key', // 使用环境变量存储,内部开发直接使用字符串了
  expiresIn: '24h',
};

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
