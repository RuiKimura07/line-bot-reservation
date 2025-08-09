import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      ssl: config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing database schema...');
      
      // UUIDエクステンションの有効化
      await this.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // テーブルが存在しない場合のみ作成
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          line_user_id VARCHAR(255) UNIQUE NOT NULL,
          display_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS time_slots (
          slot_id SERIAL PRIMARY KEY,
          slot_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          capacity INTEGER DEFAULT 1,
          available INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(slot_date, start_time)
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS reservations (
          reservation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
          reservation_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          guest_count INTEGER DEFAULT 1,
          status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
          special_requests TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          reservation_id UUID REFERENCES reservations(reservation_id) ON DELETE CASCADE,
          notification_type VARCHAR(50) NOT NULL,
          sent_at TIMESTAMP DEFAULT NOW(),
          status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
          error_message TEXT
        )
      `);

      // インデックスの作成
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id)',
        'CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date)',
        'CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status)',
        'CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(slot_date)',
        'CREATE INDEX IF NOT EXISTS idx_time_slots_available ON time_slots(available)',
        'CREATE INDEX IF NOT EXISTS idx_notification_logs_reservation_id ON notification_logs(reservation_id)'
      ];

      for (const indexQuery of indexes) {
        await this.query(indexQuery);
      }

      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const databaseService = new DatabaseService();