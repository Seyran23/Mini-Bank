import { Body, Controller, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { extractAccessToken } from '@/common/utils/extract-access-token';

import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferResponse } from './responses/transfer.response';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @ApiOperation({
    summary: 'Initiate a transfer between two accounts',
    description:
      'Returns 202 Accepted immediately; the saga runner advances the transfer asynchronously. Poll GET /transfers/:id for status.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key to safely retry this request without creating a duplicate transfer',
  })
  @ApiOkResponse({ type: TransferResponse })
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.transfersService.createTransfer(
      dto,
      accessToken,
      correlationId,
      idempotencyKey,
    );
    reply.status(status).send(body);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's transfers" })
  @ApiOkResponse({ type: TransferResponse, isArray: true })
  async listTransfers(
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.transfersService.listTransfers(accessToken, correlationId);
    reply.status(status).send(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transfer by id' })
  @ApiParam({ name: 'id', description: 'Transfer id' })
  @ApiOkResponse({ type: TransferResponse })
  async getTransfer(
    @Param('id') transferId: string,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.transfersService.getTransfer(
      transferId,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }
}
