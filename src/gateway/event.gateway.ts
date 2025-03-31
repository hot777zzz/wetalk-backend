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
import { Message } from '../server/message/message.dto/message.interface';

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
  private userGroups = new Map<string, string[]>(); // 临时存储用户群组信息

  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private messageService: MessageService,
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
      const payload = this.jwtService.verify(token);
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

      // 加入用户所在的群组 (这里需要修改，因为UserService没有getUserGroups方法)
      // 假设用户群组信息存储在用户对象中或者通过其他方式获取
      const userGroups = this.userGroups.get(username) || [];
      userGroups.forEach((groupId) => {
        client.join(`group:${groupId}`);
      });

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
    } catch (error) {
      this.logger.error(`连接处理错误: ${error.message}`);
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
    } catch (error) {
      this.logger.error(`断开连接处理错误: ${error.message}`);
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

        // 保存私聊消息到数据库 (使用现有的createMessage方法)
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
        // 保存群聊消息到数据库 (使用现有的createMessage方法)
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
      // 处理公共聊天室消息
      else {
        // 保存公共消息到数据库 (使用现有的createMessage方法)
        await this.messageService.createMessage({
          content: data.content,
          sender: sender,
          messageType: 'room',
        });

        // 广播给所有连接的客户端
        this.server.emit('receive_message', message);
      }
    } catch (error) {
      this.logger.error(`消息处理错误: ${error.message}`);
      client.emit('error', { message: '消息发送失败' });
    }
  }

  @SubscribeMessage('join_group')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    try {
      const username = this.socketUserMap.get(client.id);

      if (!username) {
        client.emit('error', { message: '未授权的操作' });
        return;
      }

      // 加入群组
      client.join(`group:${data.groupId}`);

      // 更新用户群组关系 (因为没有addUserToGroup方法，使用内存中的Map暂存)
      let userGroups = this.userGroups.get(username) || [];
      if (!userGroups.includes(data.groupId)) {
        userGroups.push(data.groupId);
        this.userGroups.set(username, userGroups);
      }

      client.emit('group_joined', { groupId: data.groupId });

      // 通知群组有新成员加入
      this.server.to(`group:${data.groupId}`).emit('group_member_joined', {
        groupId: data.groupId,
        username: username,
      });
    } catch (error) {
      this.logger.error(`加入群组错误: ${error.message}`);
      client.emit('error', { message: '加入群组失败' });
    }
  }

  @SubscribeMessage('leave_group')
  async handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    try {
      const username = this.socketUserMap.get(client.id);

      if (!username) {
        client.emit('error', { message: '未授权的操作' });
        return;
      }

      // 离开群组
      client.leave(`group:${data.groupId}`);

      // 更新用户群组关系 (因为没有removeUserFromGroup方法，使用内存中的Map暂存)
      let userGroups = this.userGroups.get(username) || [];
      userGroups = userGroups.filter((id) => id !== data.groupId);
      this.userGroups.set(username, userGroups);

      client.emit('group_left', { groupId: data.groupId });

      // 通知群组有成员离开
      this.server.to(`group:${data.groupId}`).emit('group_member_left', {
        groupId: data.groupId,
        username: username,
      });
    } catch (error) {
      this.logger.error(`离开群组错误: ${error.message}`);
      client.emit('error', { message: '离开群组失败' });
    }
  }

  @SubscribeMessage('get_message_history')
  async handleGetMessageHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      type: 'private' | 'group' | 'public';
      target?: string;
      limit?: number;
    },
  ) {
    try {
      const username = this.socketUserMap.get(client.id);

      if (!username) {
        client.emit('error', { message: '未授权的操作' });
        return;
      }

      let messages: Message[] = [];
      const limit = data.limit || 50;

      switch (data.type) {
        case 'private':
          if (!data.target) {
            client.emit('error', { message: '缺少目标用户' });
            return;
          }
          messages = await this.messageService.getPrivateMessages(
            username,
            data.target,
            limit,
          );
          break;
        case 'group':
          if (!data.target) {
            client.emit('error', { message: '缺少群组ID' });
            return;
          }
          // 使用getRoomMessages替代getGroupMessages
          messages = await this.messageService.getRoomMessages(
            data.target,
            limit,
          );
          break;
        case 'public':
          messages = await this.messageService.queryMessages({
            messageType: 'room',
            limit: limit,
          });
          break;
        default:
          client.emit('error', { message: '无效的消息类型' });
          return;
      }

      client.emit('message_history', {
        type: data.type,
        target: data.target,
        messages: messages,
      });
    } catch (error) {
      this.logger.error(`获取消息历史错误: ${error.message}`);
      client.emit('error', { message: '获取消息历史失败' });
    }
  }
}
