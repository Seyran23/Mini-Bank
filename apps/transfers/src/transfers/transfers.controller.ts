import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { UnauthorizedException } from '@minibank/errors';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { IdempotencyKeyInterceptor } from '@/common/interceptors/idempotency-key.interceptor';

import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferResponse } from './responses/transfer.response';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getAllTransfers(@CurrentUser() userId: string): Promise<TransferResponse[]> {
    return this.transfersService.listTransfers(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getTransferById(
    @CurrentUser() userId: string,
    @Param('id') transferId: string,
  ): Promise<TransferResponse> {
    return this.transfersService.getTransfer(userId, transferId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(IdempotencyKeyInterceptor)
  @HttpCode(HttpStatus.ACCEPTED)
  makeTransfer(
    @Headers('x-correlation-id') correlationId: string,
    @Headers('authorization') authorization: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferResponse> {
    const [_, accessToken] = authorization.split(' ');

    if (!accessToken) {
      throw new UnauthorizedException('Missing access token');
    }

    return this.transfersService.initiateTransfer(userId, accessToken, correlationId, dto);
  }
}
