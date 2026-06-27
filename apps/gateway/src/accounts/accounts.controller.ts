import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { extractAccessToken } from '@/common/utils/extract-access-token';

import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { AccountResponse } from './responses/account.response';
import { LedgerEntryResponse } from './responses/ledger-entry.response';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an account for the current user' })
  @ApiOkResponse({ type: AccountResponse })
  async createAccount(
    @Body() dto: CreateAccountDto,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.createAccount(
      dto,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's accounts" })
  @ApiOkResponse({ type: AccountResponse, isArray: true })
  async listAccounts(
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.listAccounts(accessToken, correlationId);
    reply.status(status).send(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account by id' })
  @ApiParam({ name: 'id', description: 'Account id' })
  @ApiOkResponse({ type: AccountResponse })
  async getAccount(
    @Param('id') accountId: string,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.getAccount(
      accountId,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }

  @Get(':id/ledger')
  @ApiOperation({ summary: "Get an account's ledger entries" })
  @ApiParam({ name: 'id', description: 'Account id' })
  @ApiOkResponse({ type: LedgerEntryResponse, isArray: true })
  async getLedger(
    @Param('id') accountId: string,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.getLedger(
      accountId,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }

  @Post(':id/deposit')
  @ApiOperation({ summary: 'Deposit funds into an account' })
  @ApiParam({ name: 'id', description: 'Account id' })
  @ApiOkResponse({ type: AccountResponse })
  async deposit(
    @Param('id') accountId: string,
    @Body() dto: DepositDto,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.deposit(
      accountId,
      dto,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw funds from an account' })
  @ApiParam({ name: 'id', description: 'Account id' })
  @ApiOkResponse({ type: AccountResponse })
  async withdraw(
    @Param('id') accountId: string,
    @Body() dto: WithdrawalDto,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.withdraw(
      accountId,
      dto,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Close an account' })
  @ApiParam({ name: 'id', description: 'Account id' })
  async closeAccount(
    @Param('id') accountId: string,
    @Req() request: FastifyRequest,
    @Headers('x-correlation-id') correlationId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const accessToken = extractAccessToken(request.headers.authorization);
    const { status, body } = await this.accountsService.closeAccount(
      accountId,
      accessToken,
      correlationId,
    );
    reply.status(status).send(body);
  }
}
