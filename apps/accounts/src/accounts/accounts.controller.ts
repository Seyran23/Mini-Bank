import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { InternalAuthGuard } from '@/common/guards/internal-auth.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Prisma } from '@/generated/prisma';

import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { DepositDto } from './dto/deposit.dto';
import { InternalTransferDto } from './dto/internal-transfer.dto';
import { WithdrawalDto } from './dto/withdrawal.dto';
import { AccountResponse } from './responses/account.response';
import { LedgerEntryResponse } from './responses/ledger-entry.response';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createAccount(
    @CurrentUser() userId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponse> {
    return this.accountsService.createAccount(userId, dto.currency);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getAllAccounts(@CurrentUser() userId: string): Promise<AccountResponse[]> {
    return this.accountsService.listAccounts(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getAccount(
    @CurrentUser() userId: string,
    @Param('id') accountId: string,
  ): Promise<AccountResponse> {
    return this.accountsService.getAccount(userId, accountId);
  }

  @Get(':id/ledger')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  getLedger(
    @CurrentUser() userId: string,
    @Param('id') accountId: string,
  ): Promise<LedgerEntryResponse[]> {
    return this.accountsService.getLedger(userId, accountId);
  }

  @Post(':id/deposit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deposit(
    @CurrentUser() userId: string,
    @Param('id') accountId: string,
    @Body() dto: DepositDto,
  ): Promise<AccountResponse> {
    const { amount, description } = dto;

    return this.accountsService.deposit(userId, accountId, new Prisma.Decimal(amount), description);
  }

  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  withdrawal(
    @CurrentUser() userId: string,
    @Param('id') accountId: string,
    @Body() dto: WithdrawalDto,
  ): Promise<AccountResponse> {
    const { amount, description } = dto;

    return this.accountsService.withdraw(
      userId,
      accountId,
      new Prisma.Decimal(amount),
      description,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  deleteAccount(@CurrentUser() userId: string, @Param('id') accountId: string): Promise<string> {
    return this.accountsService.closeAccount(userId, accountId);
  }

  @Post(':id/internal/transfer-debit')
  @UseGuards(InternalAuthGuard)
  @HttpCode(HttpStatus.OK)
  internalTransferDebit(
    @Param('id') accountId: string,
    @Body() transferDto: InternalTransferDto,
  ): Promise<AccountResponse> {
    const { transferId, amount, description } = transferDto;

    return this.accountsService.internalTransferDebit(
      accountId,
      transferId,
      new Prisma.Decimal(amount),
      description,
    );
  }

  @Post(':id/internal/transfer-credit')
  @UseGuards(InternalAuthGuard)
  @HttpCode(HttpStatus.OK)
  internalTransferCredit(
    @Param('id') accountId: string,
    @Body() transferDto: InternalTransferDto,
  ): Promise<AccountResponse> {
    const { transferId, amount, description } = transferDto;

    return this.accountsService.internalTransferCredit(
      accountId,
      transferId,
      new Prisma.Decimal(amount),
      description,
    );
  }

  @Post(':id/internal/reversal')
  @UseGuards(InternalAuthGuard)
  @HttpCode(HttpStatus.OK)
  internalTransferReversal(
    @Param('id') accountId: string,
    @Body() transferDto: InternalTransferDto,
  ): Promise<AccountResponse> {
    const { transferId, amount, description } = transferDto;

    return this.accountsService.internalTransferReversal(
      accountId,
      transferId,
      new Prisma.Decimal(amount),
      description,
    );
  }
}
