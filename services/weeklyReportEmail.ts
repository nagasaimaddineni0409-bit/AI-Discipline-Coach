import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '../firebase/config';

export async function requestWeeklyReportEmail(): Promise<{ to: string; subject: string }> {
  const fn = httpsCallable<Record<string, never>, { sent: boolean; to: string; subject: string }>(
    getFirebaseFunctions(),
    'requestWeeklyReportEmail',
  );
  const result = await fn({});
  return { to: result.data.to, subject: result.data.subject };
}
