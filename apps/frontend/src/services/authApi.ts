import { apiClient } from '../lib/axios';
import { User, ApiResponse } from '../types';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthSuccessData {
  user: User;
  token: string;
  csrfToken?: string;
}

export const authApi = {
  async register(data: RegisterPayload): Promise<User> {
    const res = await apiClient.post<ApiResponse<AuthSuccessData>>('/auth/register', data);
    return res.data.data.user;
  },

  async login(data: LoginPayload): Promise<User> {
    const res = await apiClient.post<ApiResponse<AuthSuccessData>>('/auth/login', data);
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return res.data.data.user;
  },

  async getCsrf(): Promise<string> {
    const res = await apiClient.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf');
    return res.data.data.csrfToken;
  },
};
