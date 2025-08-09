import { databaseService } from './database.service';
import { userModel } from '../models/user.model';
import { timeSlotModel } from '../models/timeslot.model';
import { reservationModel, CreateReservationData, Reservation } from '../models/reservation.model';
import { DateHelper } from '../utils/date.helper';

export interface CreateReservationRequest {
  lineUserId: string;
  displayName?: string;
  reservationDate: string;
  startTime: string;
  guestCount: number;
  specialRequests?: string;
}

export interface ReservationResult {
  success: boolean;
  reservation?: Reservation;
  error?: string;
}

export class ReservationService {
  async createReservation(request: CreateReservationRequest): Promise<ReservationResult> {
    try {
      return await databaseService.transaction(async (client) => {
        const user = await userModel.findOrCreate(request.lineUserId, request.displayName);
        
        const slot = await timeSlotModel.findSlotByDateTime(request.reservationDate, request.startTime);
        if (!slot) {
          return {
            success: false,
            error: '指定された時間枠が見つかりません',
          };
        }

        const isAvailable = await timeSlotModel.isSlotAvailable(
          request.reservationDate,
          request.startTime,
          request.guestCount
        );

        if (!isAvailable) {
          return {
            success: false,
            error: 'ご指定の時間は満席です。別の時間をお選びください。',
          };
        }

        const hasConflict = await reservationModel.hasConflictingReservation(
          user.user_id,
          request.reservationDate,
          request.startTime
        );

        if (hasConflict) {
          return {
            success: false,
            error: 'この時間にすでに予約があります',
          };
        }

        const slotReserved = await timeSlotModel.reserveSlot(slot.slot_id, request.guestCount);
        if (!slotReserved) {
          return {
            success: false,
            error: '予約の処理中にエラーが発生しました。もう一度お試しください。',
          };
        }

        const endTime = this.calculateEndTime(request.startTime);
        
        const reservationData: CreateReservationData = {
          user_id: user.user_id,
          reservation_date: request.reservationDate,
          start_time: request.startTime,
          end_time: endTime,
          guest_count: request.guestCount,
          special_requests: request.specialRequests,
        };

        const reservation = await reservationModel.create(reservationData);

        return {
          success: true,
          reservation,
        };
      });
    } catch (error) {
      console.error('Failed to create reservation:', error);
      return {
        success: false,
        error: '予約の作成中にエラーが発生しました',
      };
    }
  }

  async updateReservation(
    reservationId: string,
    newDate?: string,
    newTime?: string,
    newGuestCount?: number
  ): Promise<ReservationResult> {
    try {
      return await databaseService.transaction(async (client) => {
        const existingReservation = await reservationModel.findById(reservationId);
        if (!existingReservation || existingReservation.status !== 'confirmed') {
          return {
            success: false,
            error: '予約が見つからないか、すでにキャンセル済みです',
          };
        }

        const oldSlot = await timeSlotModel.findSlotByDateTime(
          existingReservation.reservation_date,
          existingReservation.start_time
        );

        if (oldSlot) {
          await timeSlotModel.releaseSlot(oldSlot.slot_id, existingReservation.guest_count);
        }

        const targetDate = newDate || existingReservation.reservation_date;
        const targetTime = newTime || existingReservation.start_time;
        const targetGuestCount = newGuestCount || existingReservation.guest_count;

        const newSlot = await timeSlotModel.findSlotByDateTime(targetDate, targetTime);
        if (!newSlot) {
          if (oldSlot) {
            await timeSlotModel.reserveSlot(oldSlot.slot_id, existingReservation.guest_count);
          }
          return {
            success: false,
            error: '指定された時間枠が見つかりません',
          };
        }

        const isAvailable = await timeSlotModel.isSlotAvailable(targetDate, targetTime, targetGuestCount);
        if (!isAvailable) {
          if (oldSlot) {
            await timeSlotModel.reserveSlot(oldSlot.slot_id, existingReservation.guest_count);
          }
          return {
            success: false,
            error: 'ご指定の時間は満席です',
          };
        }

        const hasConflict = await reservationModel.hasConflictingReservation(
          existingReservation.user_id,
          targetDate,
          targetTime,
          reservationId
        );

        if (hasConflict) {
          if (oldSlot) {
            await timeSlotModel.reserveSlot(oldSlot.slot_id, existingReservation.guest_count);
          }
          return {
            success: false,
            error: 'この時間にすでに別の予約があります',
          };
        }

        const slotReserved = await timeSlotModel.reserveSlot(newSlot.slot_id, targetGuestCount);
        if (!slotReserved) {
          if (oldSlot) {
            await timeSlotModel.reserveSlot(oldSlot.slot_id, existingReservation.guest_count);
          }
          return {
            success: false,
            error: '予約の更新中にエラーが発生しました',
          };
        }

        const updatedReservation = await reservationModel.update(reservationId, {
          reservation_date: targetDate,
          start_time: targetTime,
          end_time: this.calculateEndTime(targetTime),
          guest_count: targetGuestCount,
        });

        if (!updatedReservation) {
          return {
            success: false,
            error: '予約の更新に失敗しました',
          };
        }

        return {
          success: true,
          reservation: updatedReservation,
        };
      });
    } catch (error) {
      console.error('Failed to update reservation:', error);
      return {
        success: false,
        error: '予約の更新中にエラーが発生しました',
      };
    }
  }

  async cancelReservation(reservationId: string): Promise<ReservationResult> {
    try {
      return await databaseService.transaction(async (client) => {
        const reservation = await reservationModel.findById(reservationId);
        if (!reservation || reservation.status !== 'confirmed') {
          return {
            success: false,
            error: '予約が見つからないか、すでにキャンセル済みです',
          };
        }

        const slot = await timeSlotModel.findSlotByDateTime(
          reservation.reservation_date,
          reservation.start_time
        );

        if (slot) {
          await timeSlotModel.releaseSlot(slot.slot_id, reservation.guest_count);
        }

        const cancelled = await reservationModel.cancel(reservationId);
        if (!cancelled) {
          if (slot) {
            await timeSlotModel.reserveSlot(slot.slot_id, reservation.guest_count);
          }
          return {
            success: false,
            error: 'キャンセルの処理に失敗しました',
          };
        }

        const updatedReservation = await reservationModel.findById(reservationId);

        return {
          success: true,
          reservation: updatedReservation!,
        };
      });
    } catch (error) {
      console.error('Failed to cancel reservation:', error);
      return {
        success: false,
        error: 'キャンセルの処理中にエラーが発生しました',
      };
    }
  }

  async getUserReservations(lineUserId: string): Promise<Reservation[]> {
    try {
      const user = await userModel.findByLineUserId(lineUserId);
      if (!user) {
        return [];
      }

      return await reservationModel.findUpcomingReservations(user.user_id);
    } catch (error) {
      console.error('Failed to get user reservations:', error);
      return [];
    }
  }

  async getAvailableSlots(date: string) {
    try {
      if (DateHelper.isTuesday(date)) {
        return [];
      }

      if (!DateHelper.isFuture(date)) {
        return [];
      }

      return await timeSlotModel.findAvailableSlots(date);
    } catch (error) {
      console.error('Failed to get available slots:', error);
      return [];
    }
  }

  private calculateEndTime(startTime: string): string {
    const [hour, minute] = startTime.split(':').map(Number);
    const endHour = hour + 1;
    return `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  async validateReservationTime(date: string, time: string): Promise<{ valid: boolean; error?: string }> {
    if (DateHelper.isTuesday(date)) {
      return {
        valid: false,
        error: '火曜日は定休日です',
      };
    }

    if (!DateHelper.isFuture(date, time)) {
      return {
        valid: false,
        error: '過去の日時は指定できません',
      };
    }

    if (!DateHelper.isWithinBusinessHours(time)) {
      return {
        valid: false,
        error: '営業時間外です（11:00-22:00）',
      };
    }

    return { valid: true };
  }
}

export const reservationService = new ReservationService();