import { databaseService } from './database.service';
import { DateHelper } from '../utils/date.helper';

export class TimeslotInitService {
  async initializeTimeSlots(): Promise<void> {
    try {
      // 既にデータがあるかチェック
      const existingSlots = await databaseService.query(
        'SELECT COUNT(*) as count FROM time_slots WHERE slot_date >= CURRENT_DATE'
      );
      
      if (parseInt(existingSlots.rows[0].count, 10) > 0) {
        console.log('Time slots already initialized');
        return;
      }

      console.log('Initializing time slots...');

      // 今日から30日分のタイムスロットを作成
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const date = DateHelper.addDays(today, i);
        const dateString = DateHelper.formatDate(date);
        
        // 火曜日は定休日なのでスキップ
        if (DateHelper.isTuesday(dateString)) {
          continue;
        }

        // 11時から22時まで1時間ごとのスロットを作成
        for (let hour = 11; hour < 22; hour++) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

          await databaseService.query(
            `INSERT INTO time_slots (slot_date, start_time, end_time, capacity, available)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (slot_date, start_time) DO NOTHING`,
            [dateString, startTime, endTime, 4, 4]
          );
        }
      }

      console.log('Time slots initialized successfully');
    } catch (error) {
      console.error('Failed to initialize time slots:', error);
      throw error;
    }
  }
}

export const timeslotInitService = new TimeslotInitService();