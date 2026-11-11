export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  googleId: string;
  senders?: Sender[];
  slackConnection?: {
    id: string;
    slackTeamName: string | null;
    channelName: string | null;
    isActive: boolean;
    connectedAt: string;
  } | null;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  name: string;
  isDefault: boolean;
}

export interface DashboardStats {
  totalBatches: number;
  scheduledJobs: number;
  completedJobs: number;
  failedJobs: number;
  rateLimitedRecipients: number;
}

export interface EmailBatch {
  id: string;
  userId: string;
  senderId: string;
  sender: {
    email: string;
    name: string;
  };
  subject: string;
  body: string;
  scheduledAt: string;
  delaySeconds: number;
  hourlyLimit: number;
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  _count?: {
    recipients: number;
    jobs: number;
  };
}

export interface ScheduledJob {
  id: string;
  emailId: string;
  recipientId: string;
  status: 'WAITING' | 'DELAYED' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'RESCHEDULED';
  plannedExecutionTime: string;
  retryCount: number;
  failureReason: string | null;
  recipient: {
    recipientEmail: string;
  };
  email: {
    subject: string;
    sender: {
      email: string;
      name: string;
    };
  };
}

export interface SentJob {
  id: string;
  emailId: string;
  recipientId: string;
  status: 'COMPLETED';
  executedAt: string;
  etherealMessageId: string | null;
  etherealPreviewUrl: string | null;
  recipient: {
    recipientEmail: string;
  };
  email: {
    subject: string;
    sender: {
      email: string;
      name: string;
    };
  };
}
