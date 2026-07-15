// src/Config/redisClient.js
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:5000',
        socket: {
          connectTimeout: 60000,
          lazyConnect: true,
        },
      });

      this.client.on('error', (err) => console.log('Redis Client Error', err));
      this.client.on('connect', () => console.log('Redis Client Connected'));
      this.client.on('ready', () => {
        console.log('Redis Client Ready');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, expiration = 300) { // 5 minutes default
    if (!this.isConnected) return;
    try {
      await this.client.setEx(key, expiration, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key) {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async flushPattern(pattern) {
    if (!this.isConnected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis flush pattern error:', error);
    }
  }
}

export const redisClient = new RedisClient();