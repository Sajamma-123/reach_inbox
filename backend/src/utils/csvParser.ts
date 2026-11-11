import { Readable } from 'stream';
import csvParser from 'csv-parser';

export const parseRecipientsFromBuffer = async (buffer: Buffer): Promise<string[]> => {
  const content = buffer.toString('utf-8');

  // If text file with newline-separated emails
  if (!content.includes(',')) {
    return extractValidEmails(content.split(/\r?\n/));
  }

  // Parse as CSV
  return new Promise((resolve, reject) => {
    const emails: string[] = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        // Look for common email column names or scan values
        for (const [key, value] of Object.entries(row)) {
          if (
            key.toLowerCase().includes('email') ||
            key.toLowerCase().includes('mail') ||
            key.toLowerCase().includes('recipient')
          ) {
            if (isValidEmail(value)) {
              emails.push(value.trim().toLowerCase());
              return;
            }
          }
        }

        // If no matching key, inspect all values
        for (const val of Object.values(row)) {
          if (isValidEmail(val)) {
            emails.push(val.trim().toLowerCase());
            return;
          }
        }
      })
      .on('end', () => {
        const unique = Array.from(new Set(emails));
        resolve(unique);
      })
      .on('error', (err) => reject(err));
  });
};

export const extractValidEmails = (lines: string[]): string[] => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed && emailRegex.test(trimmed)) {
      emails.add(trimmed);
    }
  }

  return Array.from(emails);
};

export const isValidEmail = (email?: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};
