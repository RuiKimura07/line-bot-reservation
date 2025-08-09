import { databaseService } from '../services/database.service';

export interface TimeSlot {
  slot_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  available: number;
  created_at: Date;
}

export interface AvailableSlot extends TimeSlot {
  is_available: boolean;
}

export class TimeSlotModel {
  async findAvailableSlots(date: string): Promise<AvailableSlot[]> {
    const result = await databaseService.query(
      `SELECT *, 
              (available > 0) as is_available
       FROM time_slots 
       WHERE slot_date = $1 
       ORDER BY start_time`,
      [date]
    );
    
    return result.rows as AvailableSlot[];
  }

  async findAvailableDates(daysAhead: number = 30): Promise<string[]> {
    const result = await databaseService.query(
      `SELECT DISTINCT slot_date 
       FROM time_slots 
       WHERE slot_date >= CURRENT_DATE 
         AND slot_date <= CURRENT_DATE + INTERVAL '${daysAhead} days'
         AND available > 0
       ORDER BY slot_date`
    );
    
    return result.rows.map((row: any) => row.slot_date);
  }

  async findSlotById(slotId: number): Promise<TimeSlot | null> {
    const result = await databaseService.query(
      'SELECT * FROM time_slots WHERE slot_id = $1',
      [slotId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as TimeSlot;
  }

  async findSlotByDateTime(date: string, startTime: string): Promise<TimeSlot | null> {
    const result = await databaseService.query(
      'SELECT * FROM time_slots WHERE slot_date = $1 AND start_time = $2',
      [date, startTime]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as TimeSlot;
  }

  async reserveSlot(slotId: number, guestCount: number = 1): Promise<boolean> {
    const result = await databaseService.query(
      `UPDATE time_slots 
       SET available = available - $2 
       WHERE slot_id = $1 AND available >= $2
       RETURNING *`,
      [slotId, guestCount]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async releaseSlot(slotId: number, guestCount: number = 1): Promise<boolean> {
    const result = await databaseService.query(
      `UPDATE time_slots 
       SET available = LEAST(capacity, available + $2)
       WHERE slot_id = $1
       RETURNING *`,
      [slotId, guestCount]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async isSlotAvailable(date: string, startTime: string, guestCount: number = 1): Promise<boolean> {
    const result = await databaseService.query(
      'SELECT available FROM time_slots WHERE slot_date = $1 AND start_time = $2',
      [date, startTime]
    );
    
    if (result.rows.length === 0) {
      return false;
    }
    
    return result.rows[0].available >= guestCount;
  }

  async createSlot(date: string, startTime: string, endTime: string, capacity: number = 4): Promise<TimeSlot> {
    const result = await databaseService.query(
      `INSERT INTO time_slots (slot_date, start_time, end_time, capacity, available)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [date, startTime, endTime, capacity]
    );
    
    return result.rows[0] as TimeSlot;
  }
}

export const timeSlotModel = new TimeSlotModel();