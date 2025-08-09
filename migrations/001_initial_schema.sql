-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Time slots table
CREATE TABLE time_slots (
  slot_id SERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(slot_date, start_time)
);

-- Reservations table
CREATE TABLE reservations (
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
);

-- Notification logs table
CREATE TABLE notification_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(reservation_id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);

-- Indexes for better performance
CREATE INDEX idx_users_line_user_id ON users(line_user_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_time_slots_date ON time_slots(slot_date);
CREATE INDEX idx_time_slots_available ON time_slots(available);
CREATE INDEX idx_notification_logs_reservation_id ON notification_logs(reservation_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default time slots (example: 11:00-22:00, 1-hour slots)
DO $$
DECLARE
    current_date DATE := CURRENT_DATE;
    end_date DATE := CURRENT_DATE + INTERVAL '30 days';
    current_hour INTEGER;
BEGIN
    WHILE current_date <= end_date LOOP
        -- Skip Tuesdays (business is closed)
        IF EXTRACT(DOW FROM current_date) != 2 THEN
            current_hour := 11;
            WHILE current_hour < 22 LOOP
                INSERT INTO time_slots (slot_date, start_time, end_time, capacity, available)
                VALUES (
                    current_date,
                    (current_hour || ':00')::TIME,
                    ((current_hour + 1) || ':00')::TIME,
                    4,  -- 4 tables available per hour
                    4
                );
                current_hour := current_hour + 1;
            END LOOP;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
END $$;