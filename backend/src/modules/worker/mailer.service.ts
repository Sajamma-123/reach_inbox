import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface SendMailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailDeliveryResult {
  messageId: string;
  previewUrl: string | null;
  smtpResponse: string;
}

class MailerService {
  private transporter: Transporter | null = null;
  private initializingPromise: Promise<void> | null = null;

  private async initializeTransporter(): Promise<void> {
    if (this.transporter) return;

    if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.ETHEREAL_HOST,
        port: env.ETHEREAL_PORT,
        secure: false,
        auth: {
          user: env.ETHEREAL_USER,
          pass: env.ETHEREAL_PASS,
        },
      });
      logger.info(`📧 Mailer initialized with Ethereal account: ${env.ETHEREAL_USER}`);
    } else {
      logger.info('🔑 No Ethereal credentials found in .env. Auto-generating test account...');
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info(` Ethereal test account created: ${testAccount.user}`);
      logger.info(`📧 Ethereal web login: https://ethereal.email/login with user "${testAccount.user}"`);
    }
  }

  private async getTransporter(): Promise<Transporter> {
    if (!this.transporter) {
      if (!this.initializingPromise) {
        this.initializingPromise = this.initializeTransporter();
      }
      await this.initializingPromise;
    }
    return this.transporter!;
  }

  /**
   * Dispatches email via Ethereal SMTP transporter
   */
  async sendEmail(params: SendMailParams): Promise<MailDeliveryResult> {
    const transporter = await this.getTransporter();

    const info = await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]+>/g, ''),
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? previewUrl.toString() : null,
      smtpResponse: info.response,
    };
  }
}

export const mailerService = new MailerService();
