import { lineService } from './line.service';
import { reservationModel, ReservationWithUser } from '../models/reservation.model';
import { databaseService } from './database.service';
import { config } from '../config';
import { DateHelper } from '../utils/date.helper';

export interface ReminderJobData {
  reservationId: string;
  userId: string;
  date: string;
  time: string;
  guestCount: number;
  displayName?: string;
}

export class NotificationService {
  // シンプルなメモリベースのリマインダー管理
  private reminders: Map<string, NodeJS.Timeout> = new Map();

  async scheduleReminder(reservation: ReservationWithUser): Promise<void> {
    try {
      const reminderDate = new Date(reservation.reservation_date);
      reminderDate.setDate(reminderDate.getDate() - 1);
      reminderDate.setHours(config.business.reminderHour, 0, 0, 0);

      const now = new Date();
      if (reminderDate <= now) {
        console.log(`Reminder date is in the past for reservation ${reservation.reservation_id}`);
        return;
      }

      const delay = reminderDate.getTime() - now.getTime();
      
      const jobData: ReminderJobData = {
        reservationId: reservation.reservation_id,
        userId: reservation.line_user_id,
        date: reservation.reservation_date,
        time: reservation.start_time,
        guestCount: reservation.guest_count,
        displayName: reservation.display_name,
      };

      // タイマーをセット
      const timer = setTimeout(() => {
        this.sendReminder(jobData);
        this.reminders.delete(reservation.reservation_id);
      }, delay);

      this.reminders.set(reservation.reservation_id, timer);

      console.log(`Reminder scheduled for reservation ${reservation.reservation_id} at ${reminderDate.toISOString()}`);
    } catch (error) {
      console.error('Failed to schedule reminder:', error);
    }
  }

  async sendReminder(jobData: ReminderJobData): Promise<void> {
    try {
      const reservation = await reservationModel.findById(jobData.reservationId);
      
      if (!reservation || reservation.status !== 'confirmed') {
        console.log(`Skipping reminder for cancelled/completed reservation: ${jobData.reservationId}`);
        return;
      }

      const dateTime = DateHelper.formatDateTime(jobData.date, jobData.time);
      const displayName = jobData.displayName || 'お客様';

      const reminderMessage = this.buildReminderMessage(
        displayName,
        dateTime,
        jobData.guestCount,
        jobData.reservationId
      );

      await lineService.pushMessage(jobData.userId, reminderMessage);

      await this.logNotification(jobData.reservationId, 'reminder', 'sent');

      console.log(`Reminder sent successfully for reservation ${jobData.reservationId}`);
    } catch (error) {
      console.error(`Failed to send reminder for reservation ${jobData.reservationId}:`, error);
      
      await this.logNotification(
        jobData.reservationId,
        'reminder',
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async sendDailyReminders(): Promise<void> {
    try {
      const tomorrow = DateHelper.formatDate(DateHelper.addDays(new Date(), 1));
      const reservations = await reservationModel.findReservationsForReminder(tomorrow);

      console.log(`Found ${reservations.length} reservations for reminder on ${tomorrow}`);

      for (const reservation of reservations) {
        try {
          await this.sendReminder({
            reservationId: reservation.reservation_id,
            userId: reservation.line_user_id,
            date: reservation.reservation_date,
            time: reservation.start_time,
            guestCount: reservation.guest_count,
            displayName: reservation.display_name,
          });
        } catch (error) {
          console.error(`Failed to send individual reminder for ${reservation.reservation_id}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to send daily reminders:', error);
    }
  }

  startWorker(): void {
    console.log('Reminder notification service started');
  }

  async stopWorker(): Promise<void> {
    // すべてのタイマーをクリア
    for (const timer of this.reminders.values()) {
      clearTimeout(timer);
    }
    this.reminders.clear();
    console.log('Reminder notification service stopped');
  }

  private buildReminderMessage(
    displayName: string,
    dateTime: string,
    guestCount: number,
    reservationId: string
  ) {
    return lineService.createTextMessage(
      `🔔 予約のリマインド\n\n` +
      `${displayName}さん、明日のご予約の確認です。\n\n` +
      `📅 予約日時: ${dateTime}\n` +
      `👥 ご利用人数: ${guestCount}名\n` +
      `🆔 予約ID: ${reservationId.substring(0, 8)}\n\n` +
      `ご来店をお待ちしております！\n\n` +
      `※変更・キャンセルをご希望の場合は、\n` +
      `「予約変更」または「予約キャンセル」とお送りください。`
    );
  }

  private async logNotification(
    reservationId: string,
    notificationType: string,
    status: 'sent' | 'failed' | 'pending',
    errorMessage?: string
  ): Promise<void> {
    try {
      await databaseService.query(
        `INSERT INTO notification_logs (reservation_id, notification_type, status, error_message)
         VALUES ($1, $2, $3, $4)`,
        [reservationId, notificationType, status, errorMessage]
      );
    } catch (error) {
      console.error('Failed to log notification:', error);
    }
  }
}