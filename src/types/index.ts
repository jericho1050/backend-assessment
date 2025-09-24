export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
    created_at: Date;
    updated_at: Date;
    due_date: Date;
}

export interface TaskQuery {
    status?: 'pending' | 'in_progress' | 'completed';
    priority?: 'low' | 'medium' | 'high';
    sort?: string;
    page?: number;
    limit?: number;
    search?: string;
}