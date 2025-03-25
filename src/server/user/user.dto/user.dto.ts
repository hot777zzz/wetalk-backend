// user.dto.ts
export class CreateUserDTO {
  user_name: string;
  password: string;
  avatar?: string;
  email?: string;
  role?: string;
}

export class EditUserDTO {
  user_name: string;
  password?: string;
  avatar?: string;
  email?: string;
  role?: string;
}
