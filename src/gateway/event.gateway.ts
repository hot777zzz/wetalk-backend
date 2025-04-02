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
import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../server/user/user.service';
import { MessageService } from '../server/message/message.service';
import { GroupService } from '../server/group/group.service';

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
  ) {}

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
      const payload = this.jwtService.verify(token) as JwtPayload;
      const username = payload.username;

      if (!username) {
        this.logger.warn(`无效的token: ${client.id}`);
        client.disconnect();
        return;
      }

      // 检查用户是否存在
      const user = await this.userService.findOne(username);

      if (!user) {
        this.logger.warn(`用户不存在: ${username}`);
        client.disconnect();
        return;
      }

      // 将用户与socket关联
      this.userSocketMap.set(username, client.id);
      this.socketUserMap.set(client.id, username);

      // 加入个人房间
      client.join(`user:${username}`);

      // 加入用户所在的群组 - 直接从数据库查询并加入
      const userGroups = await this.groupService.findUserGroups(
        user._id.toString(),
      );

      // 将用户加入所有群组的房间
      for (const group of userGroups) {
        client.join(`group:${group._id.toString()}`);
        this.logger.debug(
          `用户 ${username} 加入群组房间: ${group.name} (${group._id})`,
        );
      }

      this.logger.log(`用户已连接: ${username} (${client.id})`);

      // 通知用户连接成功
      client.emit('connection_success', {
        message: '连接成功',
        username: username,
      });

      // 广播用户上线状态
      this.server.emit('user_status', {
        username: username,
        status: 'online',
      });
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

      // 构建消息对象
      const message = {
        content: data.content,
        sender: sender,
        time: new Date().toISOString(),
      };

      // 处理私聊消息
      if (data.receiver) {
        const receiverSocketId = this.userSocketMap.get(data.receiver);

        // 保存私聊消息到数据库
        await this.messageService.createMessage({
          content: data.content,
          sender: sender,
          receiver: data.receiver,
          messageType: 'private',
        });

        // 发送给接收者
        if (receiverSocketId) {
          this.server.to(`user:${data.receiver}`).emit('receive_message', {
            ...message,
            isPrivate: true,
          });
        }

        // 发送给发送者确认
        client.emit('message_sent', {
          ...message,
          receiver: data.receiver,
          isPrivate: true,
        });
      }
      // 处理群聊消息
      else if (data.groupId) {
        // 保存群聊消息到数据库
        await this.messageService.createMessage({
          content: data.content,
          sender: sender,
          roomId: data.groupId,
          messageType: 'room',
        });

        // 广播到群组
        this.server.to(`group:${data.groupId}`).emit('receive_message', {
          ...message,
          groupId: data.groupId,
          isGroup: true,
        });
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
  async notifyGroupMemberChange(groupId: string, data: any, event: string) {
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
      socketRooms.forEach((room) => client.leave(room));

      // 重新获取并加入所有群组
      const userGroups = await this.groupService.findUserGroups(
        user._id.toString(),
      );

      // 将用户加入所有群组的房间
      for (const group of userGroups) {
        client.join(`group:${group._id.toString()}`);
      }

      client.emit('groups_reloaded', {
        count: userGroups.length,
        groups: userGroups.map((g) => ({
          id: g._id.toString(),
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
