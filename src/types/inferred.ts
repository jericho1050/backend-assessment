import { taskQuerySchema } from '@/validators/tasks';
import { taskSchema } from '@/validators/tasks';
import { z } from 'zod';

export type Task = z.infer<typeof taskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
