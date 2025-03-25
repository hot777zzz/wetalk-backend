import { Injectable } from '@nestjs/common';
import * as bcryptjs from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 8;

  hashPassword(password: string): string {
    return bcryptjs.hashSync(password, this.saltRounds);
  }

  comparePassword(password: string, hash: string): boolean {
    return bcryptjs.compareSync(password, hash);
  }
}
