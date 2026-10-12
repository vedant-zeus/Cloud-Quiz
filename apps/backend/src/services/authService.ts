import { userRepository } from '../repositories/userRepository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { RegisterInput, LoginInput } from '../schemas/authSchemas.js';
import { AuthUser } from '../types/index.js';

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: AuthUser; token: string }> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const createdUser = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    const user: AuthUser = {
      id: createdUser.id,
      email: createdUser.email,
      name: createdUser.name,
      role: createdUser.role,
    };

    const token = signToken(user);
    return { user, token };
  }

  async login(input: LoginInput): Promise<{ user: AuthUser; token: string }> {
    const foundUser = await userRepository.findByEmail(input.email);
    if (!foundUser) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, foundUser.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user: AuthUser = {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role,
    };

    const token = signToken(user);
    return { user, token };
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const foundUser = await userRepository.findById(userId);
    if (!foundUser) {
      throw new UnauthorizedError('User session not found');
    }

    return {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role,
    };
  }
}

export const authService = new AuthService();
