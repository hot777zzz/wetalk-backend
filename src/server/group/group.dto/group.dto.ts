export class CreateGroupDto {
  name: string;
  description?: string;
  owner: string; // 群主ID
  members?: string[]; // 成员ID列表
  avatar?: string; // 群头像
  groupId?: string; // 添加groupId字段
}

export class UpdateGroupDto {
  name?: string;
  description?: string;
  avatar?: string;
}

export class AddMemberDto {
  userId: string;
}

export class RemoveMemberDto {
  userId: string;
}
