export class MemberInfoDto {
  _id: string;
  user_name: string;
  avatar: string;
}

export class GroupWithMembersDto {
  _id: string;
  name: string;
  description: string;
  owner: string;
  ownerInfo?: MemberInfoDto;
  members: string[];
  membersInfo: MemberInfoDto[];
  avatar: string;
}
