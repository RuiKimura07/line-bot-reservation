import { databaseService } from '../services/database.service';

export interface Reservation {
  reservation_id: string;
  user_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  special_requests?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReservationData {
  user_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  guest_count: number;
  special_requests?: string;
}

export interface UpdateReservationData {
  reservation_date?: string;
  start_time?: string;
  end_time?: string;
  guest_count?: number;
  special_requests?: string;
  status?: 'confirmed' | 'cancelled' | 'completed';
}

export interface ReservationWithUser extends Reservation {
  display_name?: string;
  line_user_id: string;
}

export class ReservationModel {
  async create(reservationData: CreateReservationData): Promise<Reservation> {
    const result = await databaseService.query(
      `INSERT INTO reservations (user_id, reservation_date, start_time, end_time, guest_count, special_requests)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        reservationData.user_id,
        reservationData.reservation_date,
        reservationData.start_time,
        reservationData.end_time,
        reservationData.guest_count,
        reservationData.special_requests,
      ]
    );
    
    return result.rows[0] as Reservation;
  }

  async findById(reservationId: string): Promise<Reservation | null> {
    const result = await databaseService.query(
      'SELECT * FROM reservations WHERE reservation_id = $1',
      [reservationId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as Reservation;
  }

  async findByIdWithUser(reservationId: string): Promise<ReservationWithUser | null> {
    const result = await databaseService.query(
      `SELECT r.*, u.display_name, u.line_user_id
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.reservation_id = $1`,
      [reservationId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as ReservationWithUser;
  }

  async findByUserId(userId: string, status?: string): Promise<Reservation[]> {
    let query = 'SELECT * FROM reservations WHERE user_id = $1';
    const params = [userId];
    
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY reservation_date DESC, start_time DESC';
    
    const result = await databaseService.query(query, params);
    return result.rows as Reservation[];
  }

  async findUpcomingReservations(userId: string): Promise<Reservation[]> {
    const result = await databaseService.query(
      `SELECT * FROM reservations 
       WHERE user_id = $1 
         AND status = 'confirmed'
         AND (reservation_date > CURRENT_DATE 
              OR (reservation_date = CURRENT_DATE AND start_time > CURRENT_TIME))
       ORDER BY reservation_date ASC, start_time ASC`,
      [userId]
    );
    
    return result.rows as Reservation[];
  }

  async findReservationsForReminder(reminderDate: string): Promise<ReservationWithUser[]> {
    const result = await databaseService.query(
      `SELECT r.*, u.display_name, u.line_user_id
       FROM reservations r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.reservation_date = $1
         AND r.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1 FROM notification_logs nl
           WHERE nl.reservation_id = r.reservation_id
             AND nl.notification_type = 'reminder'
             AND nl.status = 'sent'
         )`,
      [reminderDate]
    );
    
    return result.rows as ReservationWithUser[];
  }

  async update(reservationId: string, updateData: UpdateReservationData): Promise<Reservation | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    
    if (fields.length === 0) {
      return await this.findById(reservationId);
    }
    
    fields.push('updated_at = NOW()');
    values.push(reservationId);
    
    const query = `UPDATE reservations SET ${fields.join(', ')} WHERE reservation_id = $${paramIndex} RETURNING *`;
    
    const result = await databaseService.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as Reservation;
  }

  async cancel(reservationId: string): Promise<boolean> {
    const result = await databaseService.query(
      `UPDATE reservations 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE reservation_id = $1 AND status = 'confirmed'
       RETURNING *`,
      [reservationId]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async hasConflictingReservation(
    userId: string, 
    date: string, 
    startTime: string, 
    excludeReservationId?: string
  ): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as count
      FROM reservations 
      WHERE user_id = $1 
        AND reservation_date = $2 
        AND start_time = $3 
        AND status = 'confirmed'
    `;
    
    const params = [userId, date, startTime];
    
    if (excludeReservationId) {
      query += ' AND reservation_id != $4';
      params.push(excludeReservationId);
    }
    
    const result = await databaseService.query(query, params);
    
    return parseInt(result.rows[0].count, 10) > 0;
  }
}

export const reservationModel = new ReservationModel();