import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// @WebSocketGateway是一个装饰器，用于创建WebSocket网关类。WebSocket网关类是用于处理 WebSocket连接和消息的核心组件之一。
// 它充当WebSocket服务端的中间人，负责处理客户端发起的连接请求，并定义处理不同类型消息的逻辑
@WebSocketGateway({ cors: { origin: '*' } })
export class EventGateway {
  constructor() {}
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('newMessage')
  handleMessage(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    console.log(body);
    const msg: any = {};
    const { roomId, name, message } = body || {};
    msg.text = message;
    msg.name = name;
    msg.roomId = roomId;
    this.server.to(roomId).emit('newMessage', msg);
  }
  // 离开房间
  @SubscribeMessage('leave')
  handleLeave(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    const { roomId, name } = body || {};
    // 先广播离开消息给房间内其他人
    this.server.to(roomId).emit('leave', `用户：${name}离开了房间 ${roomId}`);
    client.leave(roomId);
  }
  // 创建房间并加入房间
  @SubscribeMessage('join')
  handleJoin(@MessageBody() body: any, @ConnectedSocket() client: Socket) {
    const { roomId, name } = body || {};
    client.join(roomId);
    // client只能给发送给发起请求的客户端
    // client.emit('join', `用户：${name}加入了房间 ${roomId}`);
    // 广播消息给除自己以外的所有客户端
    // client.broadcast.emit('join', `用户：${name}加入了房间 ${roomId}`);
    // 使用服务器实例来广播消息给所有客户端
    this.server.to(roomId).emit('join', `用户：${name}加入了房间 ${roomId}`);
  }

  // 获取当前房间的人数
  @SubscribeMessage('getRoomUsers')
  handleGetRoomUsers(
    @MessageBody() body: any,
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.server.sockets.adapter.rooms.get(body.roomId);
    if (room) {
      this.server.to(body.roomId).emit('getRoomUsers', room.size);
    } else {
      this.server.to(body.roomId).emit('getRoomUsers', 0);
    }
  }
}
