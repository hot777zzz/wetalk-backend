import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const exceptionMessage = (
          exceptionResponse as { message: string | string[] }
        ).message;
        // 确保 message 始终是字符串
        if (Array.isArray(exceptionMessage)) {
          message = exceptionMessage.join(', ');
        } else {
          message = exceptionMessage;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 记录错误日志
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${
        exception instanceof Error ? exception.stack : exception
      }`,
    );

    response.status(status).json({
      code: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
      data: null,
    });
  }
}
