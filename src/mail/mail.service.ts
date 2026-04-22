import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { welcomeTemplate } from './templates/welcome.template';
import { passwordResetTemplate } from './templates/password-reset.template';
import { passwordChangedTemplate } from './templates/password-changed.template';

interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly appName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>(
      'MAIL_FROM',
      'G-Pulse <onboarding@resend.dev>',
    );
    this.appName = this.configService.get<string>('APP_NAME', 'G-Pulse');
  }

  async sendWelcome(email: string, name: string): Promise<void> {
    await this.send({
      to: email,
      subject: `¡Bienvenido a ${this.appName}!`,
      html: welcomeTemplate(name || 'Usuario', this.appName),
    });
  }

  async sendPasswordReset(
    email: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Restablece tu contraseña en ${this.appName}`,
      html: passwordResetTemplate(name || 'Usuario', resetLink, this.appName),
    });
  }

  async sendPasswordChanged(email: string, name: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Tu contraseña fue actualizada en ${this.appName}`,
      html: passwordChangedTemplate(name || 'Usuario', this.appName),
    });
  }

  private async send(options: SendOptions): Promise<void> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      } else {
        this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
      }
    } catch (err: any) {
      this.logger.error(
        `Unexpected error sending email to ${options.to}: ${err?.message}`,
      );
    }
  }
}
