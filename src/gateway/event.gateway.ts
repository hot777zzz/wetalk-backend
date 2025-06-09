import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { UserService } from '../server/user/user.service';
import { MessageService } from '../server/message/message.service';
import { GroupService } from '../server/group/group.service';
import { FriendService } from '../server/friend/friend.service';

// 添加JWT载荷接口定义
interface JwtPayload {
  username: string;
  sub: string;
}

interface ChatMessage {
  content: string;
  sender: string;
  receiver?: string;
  groupId?: string;
  time: string;
}

// 添加好友请求接口定义
interface FriendRequest {
  _id: string;
  sender: string;
  receiver: string;
  status: string;
  senderInfo?: any;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventGateway.name);
  private userSocketMap = new Map<string, string>(); // username -> socketId
  private socketUserMap = new Map<string, string>(); // socketId -> username

  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private messageService: MessageService,
    private groupService: GroupService,
    // 注入FriendService
    @Inject(forwardRef(() => FriendService))
    private friendService: FriendService,
  ) {}

  // 将这三个方法移到类的顶层
  // 通知好友请求
  notifyFriendRequest(receiverId: string, request: FriendRequest): void {
    try {
      const receiverSocketId = this.userSocketMap.get(receiverId);
      if (receiverSocketId) {
        this.server.to(`user:${receiverId}`).emit('friend_request', request);
      }
    } catch (error: unknown) {
      this.logger.error(
        `发送好友请求通知失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  // 通知好友请求状态更新
  notifyFriendRequestUpdate(senderId: string, request: FriendRequest): void {
    try {
      const senderSocketId = this.userSocketMap.get(senderId);
      if (senderSocketId) {
        this.server
          .to(`user:${senderId}`)
          .emit('friend_request_update', request);
      }
    } catch (error: unknown) {
      this.logger.error(
        `发送好友请求状态更新通知失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  // 通知好友在线状态变化
  async notifyFriendStatus(userId: string, status: 'online' | 'offline') {
    try {
      // 获取该用户的所有好友
      const friends = await this.friendService.getFriendsList(userId);

      // 向所有好友发送状态更新
      for (const friend of friends) {
        const friendSocketId = this.userSocketMap.get(friend.user_name);
        if (friendSocketId) {
          this.server.to(`user:${friend.user_name}`).emit('friend_status', {
            friendId: userId,
            status: status,
          });
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `发送好友状态更新通知失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  async handleConnection(client: Socket) {
    try {
      // 从查询参数中获取token
      const token = client.handshake.query.token as string;

      if (!token) {
        this.logger.warn(`客户端连接未提供token: ${client.id}`);
        client.disconnect();
        return;
      }

      // 验证token
      const payload = this.jwtService.verify(token);
      const userId = payload.sub; // 使用sub作为userId

      if (!userId) {
        this.logger.warn(`无效的token: ${client.id}`);
        client.disconnect();
        return;
      }

      // 检查用户是否存在
      const user = await this.userService.findById(userId);

      if (!user) {
        this.logger.warn(`用户不存在: ${userId}`);
        client.disconnect();
        return;
      }

      // 将用户与socket关联
      this.userSocketMap.set(userId, client.id);
      this.socketUserMap.set(client.id, userId);

      // 加入个人房间
      client.join(`user:${userId}`);

      // 加入用户所在的群组
      const userGroups = await this.groupService.findUserGroups(userId);

      // 将用户加入所有群组的房间
      for (const group of userGroups) {
        const groupId = group._id.toString();
        client.join(`group:${groupId}`);
        this.logger.debug(
          `用户 ${userId} 加入群组房间: ${group.name} (${groupId})`,
        );
      }

      this.logger.log(`用户已连接: ${userId} (${client.id})`);

      // 通知用户连接成功
      client.emit('connection_success2', {
        message: '连接成功',
        userId: userId,
        username: user.user_name,
      });

      // 广播用户上线状态
      this.server.emit('user_status', {
        userId: userId,
        username: user.user_name,
        status: 'online',
      });

      // 通知好友该用户上线
      this.notifyFriendStatus(userId, 'online');
    } catch (error: unknown) {
      this.logger.error(
        `连接处理错误: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const username = this.socketUserMap.get(client.id);

      if (username) {
        // 清理映射
        this.userSocketMap.delete(username);
        this.socketUserMap.delete(client.id);

        this.logger.log(`用户已断开连接: ${username} (${client.id})`);

        // 广播用户下线状态
        this.server.emit('user_status', {
          username: username,
          status: 'offline',
        });

        // 通知好友该用户下线
        this.notifyFriendStatus(username, 'offline');
      }
    } catch (error: unknown) {
      this.logger.error(
        `断开连接处理错误: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChatMessage,
  ) {
    try {
      const sender = this.socketUserMap.get(client.id);

      if (!sender) {
        client.emit('error', { message: '未授权的消息' });
        return;
      }
      console.log('发送消息', data);

      // 获取发送者信息
      const senderUser = await this.userService.findById(data.sender);
      if (!senderUser) {
        client.emit('error', { message: '发送者信息不存在' });
        return;
      }

      // 构建消息对象
      const message = {
        content: data.content,
        sender: data.sender,
        senderName: senderUser.user_name,
        senderAvatar: senderUser.avatar || 'U',
        time: new Date().toISOString(),
      };

      // 处理私聊消息
      if (data.receiver) {
        // 检查接收者是否存在
        const receiverUser = await this.userService.findById(data.receiver);
        if (!receiverUser) {
          client.emit('error', { message: '接收者不存在' });
          return;
        }

        // 保存私聊消息到数据库
        await this.messageService.createMessage({
          content: data.content,
          sender: data.sender,
          receiver: data.receiver,
          messageType: 'private',
        });

        // 发送给接收者
        this.server.to(`user:${data.receiver}`).emit('receive_message', {
          ...message,
          isPrivate: true,
        });

        // 发送给发送者确认
        client.emit('message_sent', {
          ...message,
          receiver: data.receiver,
          isPrivate: true,
        });

        this.logger.debug(`私聊消息已发送: ${sender} -> ${data.receiver}`);
      }
      // 处理群聊消息
      else if (data.groupId) {
        // 检查群组是否存在
        const group = await this.groupService.findGroupById(data.groupId);
        if (!group) {
          client.emit('error', { message: '群组不存在' });
          return;
        }

        // 检查发送者是否在群组中
        const isMember = await this.groupService.isUserInGroup(
          data.sender,
          data.groupId,
        );
        if (!isMember) {
          client.emit('error', { message: '您不是该群组成员' });
          return;
        }

        // 保存群聊消息到数据库
        await this.messageService.createMessage({
          content: data.content,
          sender: data.sender,
          roomId: data.groupId,
          messageType: 'room',
        });

        // 广播到群组
        this.server.to(`group:${data.groupId}`).emit('receive_message', {
          ...message,
          groupId: data.groupId,
          isGroup: true,
        });

        // 发送给发送者确认
        client.emit('message_sent', {
          ...message,
          groupId: data.groupId,
          isGroup: true,
        });

        this.logger.debug(`群聊消息已发送: ${sender} -> ${data.groupId}`);
      }
    } catch (error: unknown) {
      this.logger.error(
        `消息处理错误: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      client.emit('error', { message: '消息发送失败' });
    }
  }

  // 群组相关事件通知函数
  // 这个方法供内部使用，通知群组成员变化
  notifyGroupMemberChange(groupId: string, data: any, event: string): void {
    try {
      this.server.to(`group:${groupId}`).emit(event, data);
    } catch (error: unknown) {
      this.logger.error(
        `发送群组通知失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  // 用于重新加载用户的群组
  @SubscribeMessage('reload_groups')
  async handleReloadGroups(@ConnectedSocket() client: Socket) {
    try {
      const username = this.socketUserMap.get(client.id);
      if (!username) {
        client.emit('error', { message: '未授权的操作' });
        return;
      }

      // 获取用户信息
      const user = await this.userService.findOne(username);

      // 先离开所有群组房间 (可以通过一个辅助函数实现)
      const socketRooms = [...client.rooms].filter((room) =>
        room.startsWith('group:'),
      );

      // 使用 for...of 循环替代 forEach 来避免异步问题
      for (const room of socketRooms) {
        client.leave(room);
      }

      // 重新获取并加入所有群组
      const userGroups = await this.groupService.findUserGroups(
        user._id.toString(),
      );

      // 将用户加入所有群组的房间
      for (const group of userGroups) {
        client.join(
          `group:${typeof group._id === 'object' && group._id?.toString ? group._id.toString() : group._id}`,
        );
      }

      client.emit('groups_reloaded', {
        count: userGroups.length,
        groups: userGroups.map((g) => ({
          id:
            typeof g._id === 'object' && g._id?.toString
              ? g._id.toString()
              : String(g._id),
          name: g.name,
        })),
      });
    } catch (error: unknown) {
      this.logger.error(
        `重新加载群组失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
      client.emit('error', { message: '重新加载群组失败' });
    }
  }
}
