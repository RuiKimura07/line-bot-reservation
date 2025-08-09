import { FastifyRequest, FastifyReply } from 'fastify';
import { WebhookEvent, MessageEvent, FollowEvent, TextEventMessage } from '@line/bot-sdk';
import { signatureValidator } from '../utils/signature.validator';
import { lineService } from '../services/line.service';
import { reservationHandler } from './reservation.handler';
import { faqHandler } from './faq.handler';

interface WebhookRequestBody {
  destination: string;
  events: WebhookEvent[];
}

export async function webhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const signature = request.headers['x-line-signature'] as string;
    const body = JSON.stringify(request.body);

    const validation = signatureValidator.validate(body, signature);
    if (!validation.isValid) {
      request.log.warn(`Invalid signature: ${validation.error}`);
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const webhookBody = request.body as WebhookRequestBody;
    
    if (!webhookBody.events || !Array.isArray(webhookBody.events)) {
      reply.status(400).send({ error: 'Invalid request body' });
      return;
    }

    await Promise.all(
      webhookBody.events.map(async (event) => {
        try {
          await handleEvent(event);
        } catch (error) {
          request.log.error(`Failed to handle event: ${error}`);
        }
      })
    );

    reply.status(200).send({ success: true });
  } catch (error) {
    request.log.error(`Webhook handler error: ${error}`);
    reply.status(500).send({ error: 'Internal server error' });
  }
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) {
    console.warn('Event without userId:', event);
    return;
  }

  switch (event.type) {
    case 'message':
      await handleMessageEvent(event);
      break;
    case 'follow':
      await handleFollowEvent(event);
      break;
    case 'postback':
      await handlePostbackEvent(event);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleMessageEvent(event: MessageEvent): Promise<void> {
  if (event.message.type !== 'text') {
    return;
  }

  const textMessage = event.message as TextEventMessage;
  const messageText = textMessage.text.toLowerCase().trim();

  // Check if user is in an active reservation session
  const userId = event.source.userId;
  if (userId) {
    const session = await import('../services/memory-session.service').then(m => m.redisService.getSession(userId));
    if (session && session.state === 'confirming') {
      await reservationHandler.handleTextMessage(event);
      return;
    }
  }

  if (isReservationKeyword(messageText)) {
    await reservationHandler.handleReservationRequest(event);
  } else {
    const faqResponse = await faqHandler.handleFAQ(messageText);
    if (faqResponse) {
      await lineService.replyMessage(
        event.replyToken,
        lineService.createTextMessage(faqResponse)
      );
    } else {
      await lineService.replyMessage(
        event.replyToken,
        lineService.createTextMessage(
          'こんにちは！ご用件をお聞かせください。\n\n' +
          '• 予約をご希望の場合は「予約」とお送りください\n' +
          '• 営業時間やアクセスなどのお問い合わせも承ります'
        )
      );
    }
  }
}

async function handleFollowEvent(event: FollowEvent): Promise<void> {
  const userId = event.source.userId;
  if (!userId) return;

  try {
    const profile = await lineService.getProfile(userId);
    
    const welcomeMessage = 
      `${profile.displayName}さん、友だち追加ありがとうございます！🎉\n\n` +
      'こちらは予約管理ボットです。\n' +
      '以下のようなことができます：\n\n' +
      '📅 予約の作成・変更・キャンセル\n' +
      '⏰ 営業時間のご案内\n' +
      '📍 アクセス情報のご案内\n' +
      '🍽️ メニューのご案内\n\n' +
      'ご予約をご希望の場合は「予約」とお送りください！';

    await lineService.replyMessage(
      event.replyToken,
      lineService.createTextMessage(welcomeMessage)
    );
  } catch (error) {
    console.error('Failed to handle follow event:', error);
    
    await lineService.replyMessage(
      event.replyToken,
      lineService.createTextMessage(
        '友だち追加ありがとうございます！\n' +
        'ご予約をご希望の場合は「予約」とお送りください。'
      )
    );
  }
}

async function handlePostbackEvent(event: any): Promise<void> {
  await reservationHandler.handlePostback(event);
}

function isReservationKeyword(text: string): boolean {
  const reservationKeywords = [
    '予約', 'よやく', 'reservation', 'book', 'booking',
    '予約したい', '予約お願いします', '席を予約', 'テーブル予約'
  ];
  
  return reservationKeywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
}