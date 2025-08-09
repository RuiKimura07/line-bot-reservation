export class DateHelper {
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static formatTime(time: string): string {
    return time.substring(0, 5);
  }

  static formatDateTime(date: string, time: string): string {
    const dateObj = new Date(date);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[dateObj.getDay()];
    
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    
    return `${month}月${day}日(${dayOfWeek}) ${this.formatTime(time)}`;
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static isToday(date: string): boolean {
    const today = new Date();
    const targetDate = new Date(date);
    return this.formatDate(today) === this.formatDate(targetDate);
  }

  static isFuture(date: string, time?: string): boolean {
    const now = new Date();
    const targetDate = new Date(date);
    
    if (time) {
      const [hour, minute] = time.split(':').map(Number);
      targetDate.setHours(hour, minute, 0, 0);
    } else {
      targetDate.setHours(0, 0, 0, 0);
    }
    
    return targetDate > now;
  }

  static isTuesday(date: string): boolean {
    const dateObj = new Date(date);
    return dateObj.getDay() === 2;
  }

  static getNextAvailableDate(): Date {
    const tomorrow = this.addDays(new Date(), 1);
    
    if (this.isTuesday(this.formatDate(tomorrow))) {
      return this.addDays(tomorrow, 1);
    }
    
    return tomorrow;
  }

  static getAvailableDates(daysAhead: number = 30): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 1; i <= daysAhead; i++) {
      const date = this.addDays(today, i);
      const dateString = this.formatDate(date);
      
      if (!this.isTuesday(dateString)) {
        dates.push(dateString);
      }
    }
    
    return dates;
  }

  static getJapaneseDate(date: string): string {
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[dateObj.getDay()];
    
    return `${month}月${day}日(${dayOfWeek})`;
  }

  static isWithinBusinessHours(time: string): boolean {
    const hour = parseInt(time.split(':')[0], 10);
    return hour >= 11 && hour < 22;
  }

  static parseDateTime(dateTimeString: string): { date: string; time: string } | null {
    const patterns = [
      /(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})/,
      /(\d{4})-(\d{2})-(\d{2}).*?(\d{1,2}):(\d{2})/,
      /(\d{1,2})\/(\d{1,2}).*?(\d{1,2}):(\d{2})/,
    ];
    
    for (const pattern of patterns) {
      const match = dateTimeString.match(pattern);
      if (match) {
        let year = new Date().getFullYear();
        let month: number, day: number, hour: number, minute: number;
        
        if (pattern.source.includes('\\d{4}')) {
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10);
          day = parseInt(match[3], 10);
          hour = parseInt(match[4], 10);
          minute = parseInt(match[5], 10);
        } else {
          month = parseInt(match[1], 10);
          day = parseInt(match[2], 10);
          hour = parseInt(match[3], 10);
          minute = parseInt(match[4], 10);
        }
        
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        return { date, time };
      }
    }
    
    return null;
  }
}