import { Client, MessageEvent, FollowEvent, WebhookEvent, TextMessage, Message } from '@line/bot-sdk';
import { config } from '../config';

export class LineService {
  private client: Client;

  constructor() {
    this.client = new Client({
      channelAccessToken: config.line.channelAccessToken,
      channelSecret: config.line.channelSecret,
    });
  }

  async replyMessage(replyToken: string, messages: Message | Message[]): Promise<void> {
    try {
      await this.client.replyMessage(
        replyToken,
        Array.isArray(messages) ? messages : [messages]
      );
    } catch (error) {
      console.error('Failed to reply message:', error);
      throw error;
    }
  }

  async pushMessage(to: string, messages: Message | Message[]): Promise<void> {
    try {
      await this.client.pushMessage(
        to,
        Array.isArray(messages) ? messages : [messages]
      );
    } catch (error) {
      console.error('Failed to push message:', error);
      throw error;
    }
  }

  async getProfile(userId: string): Promise<any> {
    try {
      return await this.client.getProfile(userId);
    } catch (error) {
      console.error('Failed to get profile:', error);
      throw error;
    }
  }

  createTextMessage(text: string): TextMessage {
    return {
      type: 'text',
      text,
    };
  }

  isMessageEvent(event: WebhookEvent): event is MessageEvent {
    return event.type === 'message';
  }

  isFollowEvent(event: WebhookEvent): event is FollowEvent {
    return event.type === 'follow';
  }
}

export const lineService = new LineService();