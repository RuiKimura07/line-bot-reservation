import { FlexMessage, QuickReply, QuickReplyItem, TemplateMessage, Message } from '@line/bot-sdk';
import { DateHelper } from './date.helper';
import { AvailableSlot } from '../models/timeslot.model';
import { Reservation } from '../models/reservation.model';

export class MessageBuilder {
  static buildDatePicker(): FlexMessage {
    const dates = DateHelper.getAvailableDates(14);
    const contents = dates.slice(0, 12).map(date => {
      const japaneseDate = DateHelper.getJapaneseDate(date);
      return {
        type: 'button',
        action: {
          type: 'postback',
          label: japaneseDate,
          data: `action=select_date&date=${date}`,
        },
        style: 'primary',
        margin: 'sm',
      };
    });

    return {
      type: 'flex',
      altText: '予約日を選択してください',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📅 予約日を選択',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご希望の予約日をお選びください',
              margin: 'md',
              color: '#666666',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: contents,
              margin: 'lg',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label: 'キャンセル',
                data: 'action=cancel',
              },
              style: 'secondary',
            },
          ],
        },
      },
    };
  }

  static buildTimePicker(date: string, availableSlots: AvailableSlot[]): FlexMessage {
    const japaneseDate = DateHelper.getJapaneseDate(date);
    
    const timeButtons = availableSlots
      .filter(slot => slot.is_available)
      .slice(0, 10)
      .map(slot => ({
        type: 'button',
        action: {
          type: 'postback',
          label: `${DateHelper.formatTime(slot.start_time)} (${slot.available}席)`,
          data: `action=select_time&date=${date}&time=${slot.start_time}&slot_id=${slot.slot_id}`,
        },
        style: 'primary',
        margin: 'sm',
      }));

    if (timeButtons.length === 0) {
      return {
        type: 'flex',
        altText: '申し訳ございません',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '😔 申し訳ございません',
                weight: 'bold',
                size: 'lg',
                color: '#FF6B6B',
              },
              {
                type: 'text',
                text: `${japaneseDate}は満席のため、ご予約をお受けできません。`,
                margin: 'md',
                wrap: true,
              },
              {
                type: 'button',
                action: {
                  type: 'postback',
                  label: '別の日程で探す',
                  data: 'action=restart',
                },
                style: 'primary',
                margin: 'lg',
              },
            ],
          },
        },
      };
    }

    return {
      type: 'flex',
      altText: '予約時間を選択してください',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '⏰ 予約時間を選択',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446',
            },
            {
              type: 'text',
              text: japaneseDate,
              size: 'md',
              color: '#666666',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご希望の時間をお選びください',
              margin: 'md',
              color: '#666666',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: timeButtons,
              margin: 'lg',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label: '日程を選び直す',
                data: 'action=back_to_date',
              },
              style: 'secondary',
            },
          ],
        },
      },
    };
  }

  static buildGuestCountSelector(date: string, time: string, slotId: number): Message {
    const quickReplyItems: QuickReplyItem[] = [];
    
    for (let i = 1; i <= 6; i++) {
      quickReplyItems.push({
        type: 'action',
        action: {
          type: 'postback',
          label: `${i}名`,
          data: `action=set_guest_count&date=${date}&time=${time}&slot_id=${slotId}&count=${i}`,
        },
      });
    }

    return {
      type: 'text',
      text: `👥 ご利用人数をお選びください\n\n📅 ${DateHelper.formatDateTime(date, time)}`,
      quickReply: {
        items: quickReplyItems,
      },
    };
  }

  static buildReservationConfirmation(
    date: string, 
    time: string, 
    guestCount: number, 
    slotId: number,
    specialRequests?: string
  ): FlexMessage {
    const dateTime = DateHelper.formatDateTime(date, time);
    
    return {
      type: 'flex',
      altText: '予約内容を確認してください',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '✅ 予約内容の確認',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📅 予約日時',
                  weight: 'bold',
                  size: 'sm',
                  color: '#333333',
                },
                {
                  type: 'text',
                  text: dateTime,
                  size: 'lg',
                  weight: 'bold',
                  margin: 'xs',
                },
              ],
              margin: 'md',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '👥 ご利用人数',
                  weight: 'bold',
                  size: 'sm',
                  color: '#333333',
                },
                {
                  type: 'text',
                  text: `${guestCount}名`,
                  size: 'lg',
                  weight: 'bold',
                  margin: 'xs',
                },
              ],
              margin: 'md',
            },
            ...(specialRequests ? [{
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📝 特別なご要望',
                  weight: 'bold',
                  size: 'sm',
                  color: '#333333',
                },
                {
                  type: 'text',
                  text: specialRequests,
                  size: 'md',
                  margin: 'xs',
                  wrap: true,
                },
              ],
              margin: 'md',
            }] : []),
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'postback',
                label: '予約を確定する',
                data: `action=confirm&date=${date}&time=${time}&slot_id=${slotId}&count=${guestCount}${specialRequests ? `&requests=${encodeURIComponent(specialRequests)}` : ''}`,
              },
              style: 'primary',
            },
            {
              type: 'button',
              action: {
                type: 'postback',
                label: '内容を変更する',
                data: 'action=restart',
              },
              style: 'secondary',
              margin: 'sm',
            },
          ],
        },
      },
    };
  }

  static buildReservationComplete(reservation: Reservation): FlexMessage {
    const dateTime = DateHelper.formatDateTime(reservation.reservation_date, reservation.start_time);
    
    return {
      type: 'flex',
      altText: '予約が完了しました',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🎉 予約完了',
              weight: 'bold',
              size: 'xl',
              color: '#1DB446',
            },
          ],
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご予約ありがとうございます！',
              size: 'md',
              margin: 'md',
            },
            {
              type: 'separator',
              margin: 'lg',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📅 予約日時',
                  weight: 'bold',
                  size: 'sm',
                  color: '#333333',
                  margin: 'lg',
                },
                {
                  type: 'text',
                  text: dateTime,
                  size: 'lg',
                  weight: 'bold',
                  margin: 'xs',
                },
                {
                  type: 'text',
                  text: '👥 ご利用人数',
                  weight: 'bold',
                  size: 'sm',
                  color: '#333333',
                  margin: 'lg',
                },
                {
                  type: 'text',
                  text: `${reservation.guest_count}名`,
                  size: 'lg',
                  weight: 'bold',
                  margin: 'xs',
                },
                {
                  type: 'text',
                  text: `予約ID: ${reservation.reservation_id.substring(0, 8)}`,
                  size: 'xs',
                  color: '#666666',
                  margin: 'lg',
                },
              ],
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '前日にリマインドをお送りします。\nご不明な点がございましたらお気軽にお声がけください。',
              size: 'sm',
              color: '#666666',
              wrap: true,
            },
          ],
        },
      },
    };
  }

  static buildErrorMessage(message: string): Message {
    return {
      type: 'text',
      text: `❌ ${message}\n\nもう一度お試しください。`,
    };
  }
}

export const messageBuilder = MessageBuilder;