import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

import { createLogger } from '@minibank/logger';

import { notificationsConfig } from '@/config/notifications.config';

@Injectable()
export class EmailSender {
  private readonly logger = createLogger('notifications');

  private transporter = nodemailer.createTransport({
    host: notificationsConfig.SMTP_HOST,
    port: Number(notificationsConfig.SMTP_PORT),
    auth: notificationsConfig.SMTP_USER
      ? { user: notificationsConfig.SMTP_USER, pass: notificationsConfig.SMTP_PASSWORD }
      : undefined,
  });

  async send(to: string, subject: string, body: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: notificationsConfig.EMAIL_FROM,
        to,
        subject,
        text: body,
      });
      this.logger.info({ to, subject }, 'Email sent');
    } catch (err) {
      this.logger.error(
        { to, subject, err: err instanceof Error ? err.message : String(err) },
        'Failed to send email',
      );
      throw err;
    }
  }
}
