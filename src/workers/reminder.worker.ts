import * as cron from 'node-cron';
import { NotificationService } from '../services/notification.service';

const notificationService = new NotificationService();
import { config } from '../config';

export class ReminderWorker {
  private cronJob?: cron.ScheduledTask;

  start(): void {
    notificationService.startWorker();

    const cronExpression = `0 ${config.business.reminderHour} * * *`;
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      console.log('Running daily reminder job...');
      try {
        await notificationService.sendDailyReminders();
        console.log('Daily reminder job completed successfully');
      } catch (error) {
        console.error('Daily reminder job failed:', error);
      }
    }, {
      timezone: 'Asia/Tokyo',
    });

    console.log(`Reminder cron job scheduled at ${cronExpression} (JST)`);
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Reminder cron job stopped');
    }
    
    notificationService.stopWorker();
  }
}

export const reminderWorker = new ReminderWorker();

if (require.main === module) {
  console.log('Starting reminder worker...');
  reminderWorker.start();

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, stopping reminder worker...');
    reminderWorker.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, stopping reminder worker...');
    reminderWorker.stop();
    process.exit(0);
  });
}