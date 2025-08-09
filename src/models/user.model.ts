import { databaseService } from '../services/database.service';

export interface User {
  user_id: string;
  line_user_id: string;
  display_name?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  line_user_id: string;
  display_name?: string;
}

export class UserModel {
  async findByLineUserId(lineUserId: string): Promise<User | null> {
    const result = await databaseService.query(
      'SELECT * FROM users WHERE line_user_id = $1',
      [lineUserId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as User;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await databaseService.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as User;
  }

  async create(userData: CreateUserData): Promise<User> {
    const result = await databaseService.query(
      `INSERT INTO users (line_user_id, display_name) 
       VALUES ($1, $2) 
       RETURNING *`,
      [userData.line_user_id, userData.display_name]
    );
    
    return result.rows[0] as User;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<User | null> {
    const result = await databaseService.query(
      `UPDATE users 
       SET display_name = $1, updated_at = NOW() 
       WHERE user_id = $2 
       RETURNING *`,
      [displayName, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0] as User;
  }

  async findOrCreate(lineUserId: string, displayName?: string): Promise<User> {
    let user = await this.findByLineUserId(lineUserId);
    
    if (!user) {
      user = await this.create({
        line_user_id: lineUserId,
        display_name: displayName,
      });
    } else if (displayName && user.display_name !== displayName) {
      user = await this.updateDisplayName(user.user_id, displayName) || user;
    }
    
    return user;
  }
}

export const userModel = new UserModel();