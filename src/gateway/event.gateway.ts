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
}
