import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class SignatureValidator {
  private readonly channelSecret: string;

  constructor(channelSecret?: string) {
    this.channelSecret = channelSecret || config.line.channelSecret;
  }

  validate(body: string, signature: string): ValidationResult {
    if (!signature) {
      return {
        isValid: false,
        error: 'Missing X-Line-Signature header',
      };
    }

    if (!body) {
      return {
        isValid: false,
        error: 'Empty request body',
      };
    }

    try {
      const hash = createHmac('sha256', this.channelSecret)
        .update(body, 'utf8')
        .digest('base64');

      const expectedSignature = `sha256=${hash}`;
      const providedSignature = signature;

      if (expectedSignature.length !== providedSignature.length) {
        return {
          isValid: false,
          error: 'Invalid signature length',
        };
      }

      const isValid = timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(providedSignature, 'utf8')
      );

      if (!isValid) {
        return {
          isValid: false,
          error: 'Invalid signature',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Signature validation failed: ${error}`,
      };
    }
  }
}

export const signatureValidator = new SignatureValidator();