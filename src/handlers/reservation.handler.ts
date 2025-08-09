import { MessageEvent, PostbackEvent, TextEventMessage } from '@line/bot-sdk';
import { lineService } from '../services/line.service';
import { reservationService } from '../services/reservation.service';
// Render.com無料版用：メモリセッションを使用
import { redisService, SessionData } from '../services/memory-session.service';
import { messageBuilder } from '../utils/message.builder';
import { DateHelper } from '../utils/date.helper';

export class ReservationHandler {
  async handleReservationRequest(event: MessageEvent): Promise<void> {
    const userId = event.source.userId;
    if (!userId) return;

    try {
      await redisService.setSession(userId, {
        userId,
        state: 'selecting_date',
      });

      const datePickerMessage = messageBuilder.buildDatePicker();
      await lineService.replyMessage(event.replyToken, datePickerMessage);
    } catch (error) {
      console.error('Failed to handle reservation request:', error);
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('予約の開始に失敗しました')
      );
    }
  }

  async handlePostback(event: PostbackEvent): Promise<void> {
    const userId = event.source.userId;
    if (!userId) return;

    try {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get('action');

      switch (action) {
        case 'select_date':
          await this.handleDateSelection(event, data);
          break;
        case 'select_time':
          await this.handleTimeSelection(event, data);
          break;
        case 'set_guest_count':
          await this.handleGuestCountSelection(event, data);
          break;
        case 'confirm':
          await this.handleConfirmation(event, data);
          break;
        case 'cancel':
        case 'restart':
          await this.handleCancel(event);
          break;
        case 'back_to_date':
          await this.handleBackToDate(event);
          break;
        default:
          console.log(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Failed to handle postback:', error);
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('処理中にエラーが発生しました')
      );
    }
  }

  async handleTextMessage(event: MessageEvent): Promise<void> {
    const userId = event.source.userId;
    if (!userId) return;

    const textMessage = event.message as TextEventMessage;
    const messageText = textMessage.text.trim();

    try {
      const session = await redisService.getSession(userId);
      if (!session) return;

      if (session.state === 'confirming' && messageText.length > 0) {
        await redisService.updateSession(userId, {
          specialRequests: messageText,
        });

        const updatedSession = await redisService.getSession(userId);
        if (!updatedSession?.selectedDate || !updatedSession?.selectedTime || !updatedSession?.guestCount) {
          await lineService.replyMessage(
            event.replyToken,
            messageBuilder.buildErrorMessage('セッション情報が不完全です')
          );
          return;
        }

        const confirmation = messageBuilder.buildReservationConfirmation(
          updatedSession.selectedDate,
          updatedSession.selectedTime,
          updatedSession.guestCount,
          0, // slot_id will be determined later
          messageText
        );

        await lineService.replyMessage(event.replyToken, confirmation);
      }
    } catch (error) {
      console.error('Failed to handle text message:', error);
    }
  }

  private async handleDateSelection(event: PostbackEvent, data: URLSearchParams): Promise<void> {
    const userId = event.source.userId!;
    const date = data.get('date');

    if (!date) {
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('日付の選択に失敗しました')
      );
      return;
    }

    const validation = await reservationService.validateReservationTime(date, '12:00');
    if (!validation.valid) {
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage(validation.error!)
      );
      return;
    }

    const availableSlots = await reservationService.getAvailableSlots(date);
    
    await redisService.updateSession(userId, {
      selectedDate: date,
      state: 'selecting_time',
    });

    const timePickerMessage = messageBuilder.buildTimePicker(date, availableSlots);
    await lineService.replyMessage(event.replyToken, timePickerMessage);
  }

  private async handleTimeSelection(event: PostbackEvent, data: URLSearchParams): Promise<void> {
    const userId = event.source.userId!;
    const date = data.get('date');
    const time = data.get('time');
    const slotId = data.get('slot_id');

    if (!date || !time || !slotId) {
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('時間の選択に失敗しました')
      );
      return;
    }

    await redisService.updateSession(userId, {
      selectedTime: time,
      state: 'confirming',
    });

    const guestCountMessage = messageBuilder.buildGuestCountSelector(date, time, parseInt(slotId, 10));
    await lineService.replyMessage(event.replyToken, guestCountMessage);
  }

  private async handleGuestCountSelection(event: PostbackEvent, data: URLSearchParams): Promise<void> {
    const userId = event.source.userId!;
    const date = data.get('date');
    const time = data.get('time');
    const slotId = data.get('slot_id');
    const count = data.get('count');

    if (!date || !time || !slotId || !count) {
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('人数の選択に失敗しました')
      );
      return;
    }

    const guestCount = parseInt(count, 10);

    await redisService.updateSession(userId, {
      guestCount,
    });

    const confirmationMessage = messageBuilder.buildReservationConfirmation(
      date,
      time,
      guestCount,
      parseInt(slotId, 10)
    );

    await lineService.replyMessage(event.replyToken, [
      confirmationMessage,
      lineService.createTextMessage(
        '特別なご要望がございましたら、このままメッセージをお送りください。\n' +
        'ない場合は「予約を確定する」ボタンを押してください。'
      ),
    ]);
  }

  private async handleConfirmation(event: PostbackEvent, data: URLSearchParams): Promise<void> {
    const userId = event.source.userId!;
    const date = data.get('date');
    const time = data.get('time');
    const slotId = data.get('slot_id');
    const count = data.get('count');
    const requests = data.get('requests');

    if (!date || !time || !count) {
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('予約情報が不完全です')
      );
      return;
    }

    const guestCount = parseInt(count, 10);

    try {
      const profile = await lineService.getProfile(userId);
      
      const result = await reservationService.createReservation({
        lineUserId: userId,
        displayName: profile.displayName,
        reservationDate: date,
        startTime: time,
        guestCount,
        specialRequests: requests ? decodeURIComponent(requests) : undefined,
      });

      if (result.success && result.reservation) {
        const completeMessage = messageBuilder.buildReservationComplete(result.reservation);
        await lineService.replyMessage(event.replyToken, completeMessage);
        await redisService.deleteSession(userId);
      } else {
        await lineService.replyMessage(
          event.replyToken,
          messageBuilder.buildErrorMessage(result.error || '予約の作成に失敗しました')
        );
      }
    } catch (error) {
      console.error('Failed to create reservation:', error);
      await lineService.replyMessage(
        event.replyToken,
        messageBuilder.buildErrorMessage('予約の作成中にエラーが発生しました')
      );
    }
  }

  private async handleCancel(event: PostbackEvent): Promise<void> {
    const userId = event.source.userId!;
    
    await redisService.deleteSession(userId);
    await lineService.replyMessage(
      event.replyToken,
      lineService.createTextMessage('予約をキャンセルしました。\n\n再度予約をご希望の場合は「予約」とお送りください。')
    );
  }

  private async handleBackToDate(event: PostbackEvent): Promise<void> {
    const userId = event.source.userId!;
    
    await redisService.updateSession(userId, {
      selectedDate: undefined,
      selectedTime: undefined,
      guestCount: undefined,
      state: 'selecting_date',
    });

    const datePickerMessage = messageBuilder.buildDatePicker();
    await lineService.replyMessage(event.replyToken, datePickerMessage);
  }
}

export const reservationHandler = new ReservationHandler();