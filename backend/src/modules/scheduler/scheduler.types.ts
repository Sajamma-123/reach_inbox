export interface EmailJobPayload {
  emailId: string;
  recipientId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  toEmail: string;
  subject: string;
  body: string;
  hourlyLimit: number;
  delaySeconds: number;
  sequenceIndex: number;
  attemptNumber?: number;
}

export interface ScheduleBatchDTO {
  senderId?: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: string; // ISO date string
  delaySeconds?: number;
  hourlyLimit?: number;
}
