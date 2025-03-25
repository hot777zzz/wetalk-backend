import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { UserService } from '../server/user/user.service';
import { JwtService } from '@nestjs/jwt';

// 定义消息接口
interface ChatMessage {
  content: string;
  sender: string;
  receiver?: string; // 可选，用于私聊
  roomId?: string; // 可选，用于群聊
  timestamp?: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventGateway');
  private userSocketMap = new Map<string, string>(); // 用户ID -> socketId

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // 初始化完成后的钩子
  afterInit(server: Server) {
    this.logger.log('WebSocket 服务器初始化完成');
  }

  // 处理客户端连接
  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
  }

  // 处理客户端断开连接
  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开连接: ${client.id}`);
    // 从映射中移除断开连接的用户
    for (const [userId, socketId] of this.userSocketMap.entries()) {
      if (socketId === client.id) {
        this.userSocketMap.delete(userId);
        this.logger.log(`用户 ${userId} 已断开连接`);
        break;
      }
    }
  }

  // 使用JWT验证
  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { token } = data;
      if (!token) {
        return { status: 'error', message: '缺少令牌' };
      }

      // 验证JWT令牌
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      const username = payload.username;

      // 验证用户是否存在
      await this.userService.findOne(username);

      // 注册用户与Socket的映射
      this.userSocketMap.set(userId, client.id);
      this.logger.log(
        `用户 ${username}(${userId}) 已注册，Socket ID: ${client.id}`,
      );

      return {
        status: 'success',
        message: '注册成功',
        userId,
        username,
      };
    } catch (error) {
      this.logger.error(`用户注册失败: ${error.message}`);
      return { status: 'error', message: '身份验证失败' };
    }
  }

  // 发送公共消息（广播）
  @SubscribeMessage('sendPublicMessage')
  handlePublicMessage(
    @MessageBody() message: ChatMessage,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`收到公共消息: ${JSON.stringify(message)}`);

    // 添加时间戳（如果没有）
    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    // 广播消息给所有客户端
    this.server.emit('publicMessage', message);

    return { status: 'success', message: '消息发送成功' };
  }

  // 发送私聊消息
  @SubscribeMessage('sendPrivateMessage')
  handlePrivateMessage(
    @MessageBody() message: ChatMessage,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`收到私聊消息: ${JSON.stringify(message)}`);

    if (!message.receiver) {
      return { status: 'error', message: '缺少接收者信息' };
    }

    // 添加时间戳（如果没有）
    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    // 获取接收者的 socket ID
    const receiverSocketId = this.userSocketMap.get(message.receiver);

    if (receiverSocketId) {
      // 发送给接收者
      this.server.to(receiverSocketId).emit('privateMessage', message);
      // 也发送给发送者（确认消息已发送）
      client.emit('privateMessage', message);
      return { status: 'success', message: '私聊消息发送成功' };
    } else {
      return { status: 'error', message: '接收者不在线' };
    }
  }

  // 加入聊天室
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data;
    client.join(roomId);
    this.logger.log(`客户端 ${client.id} 加入房间 ${roomId}`);
    return { status: 'success', message: `已加入房间 ${roomId}` };
  }

  // 离开聊天室
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data;
    client.leave(roomId);
    this.logger.log(`客户端 ${client.id} 离开房间 ${roomId}`);
    return { status: 'success', message: `已离开房间 ${roomId}` };
  }

  // 发送房间消息
  @SubscribeMessage('sendRoomMessage')
  handleRoomMessage(
    @MessageBody() message: ChatMessage,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`收到房间消息: ${JSON.stringify(message)}`);

    if (!message.roomId) {
      return { status: 'error', message: '缺少房间ID' };
    }

    // 添加时间戳（如果没有）
    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    // 发送消息给房间内所有人
    this.server.to(message.roomId).emit('roomMessage', message);

    return { status: 'success', message: '房间消息发送成功' };
  }

  // 获取在线用户列表
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    const onlineUsers = Array.from(this.userSocketMap.keys());
    return { status: 'success', data: onlineUsers };
  }
}
