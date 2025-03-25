// user.dto.ts
export class CreateUserDTO {
  readonly user_name: string;
  readonly password: string;
}

export class EditUserDTO {
  readonly user_name?: string;
  readonly password?: string;
  readonly company?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly position?: string;
  readonly birth_date?: Date;
  readonly note?: string;
}
