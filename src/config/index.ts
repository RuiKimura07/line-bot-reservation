import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
  line: {
    channelAccessToken: string;
    channelSecret: string;
  };
  database: {
    url: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  business: {
    reminderHour: number;
    startHour: number;
    endHour: number;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    console.warn(`Environment variable ${key} is not set, using default or empty`);
    return '';
  }
  return value;
}

export const config: Config = {
  line: {
    channelAccessToken: getEnv('LINE_CHANNEL_ACCESS_TOKEN', ''),
    channelSecret: getEnv('LINE_CHANNEL_SECRET', ''),
  },
  database: {
    url: getEnv('DATABASE_URL', 'postgresql://localhost:5432/line_bot_reservation'),
  },
  server: {
    port: parseInt(getEnv('PORT', '3000'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
  },
  business: {
    reminderHour: parseInt(getEnv('REMINDER_HOUR', '10'), 10),
    startHour: parseInt(getEnv('BUSINESS_HOURS_START', '11'), 10),
    endHour: parseInt(getEnv('BUSINESS_HOURS_END', '22'), 10),
  },
};