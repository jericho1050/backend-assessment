import {
  taskQuerySchema,
  taskSchema,
  taskWithMetadataSchema,
  createTaskSchema,
  updateTaskSchema
} from '@/validators/tasks';
import {
  userSchema,
  publicUserSchema,
  jwtPayloadSchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
  tokenResponseSchema,
  authResponseSchema,
  userRoleSchema
} from '@/validators/auth';
import { z } from 'zod';

// Task types
export type Task = z.infer<typeof taskSchema>;
export type TaskWithMetadata = z.infer<typeof taskWithMetadataSchema>;
export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;

// Auth types
export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;
export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
