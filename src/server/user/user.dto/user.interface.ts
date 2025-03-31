// user.interface.ts
import { Document } from 'mongoose';

export interface User extends Document {
  readonly _id: string;
  readonly user_name: string;
  readonly password: string;
  readonly avatar?: string;
  readonly company: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly position: string;
  readonly birth_date: Date;
  readonly note?: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}
