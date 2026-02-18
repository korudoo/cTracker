import type { TransactionStatus, TransactionType } from '@/types/domain';

export const AUTO_STATUS_TIMEZONE = 'Asia/Kathmandu';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pending',
  deducted: 'Deducted',
  cleared: 'Cleared',
};

const ALLOWED_STATUSES_BY_TYPE: Record<TransactionType, TransactionStatus[]> = {
  cheque: ['pending', 'deducted', 'cleared'],
  deposit: ['pending', 'cleared'],
  withdrawal: ['pending', 'deducted'],
};

const PAST_OR_TODAY_CHEQUE_STATUSES: TransactionStatus[] = ['deducted', 'cleared'];

export function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value);
}

export function getTodayIsoInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to resolve date parts for timezone: ${timezone}`);
  }

  return `${year}-${month}-${day}`;
}

export function getTodayIsoInKathmandu(): string {
  return getTodayIsoInTimezone(AUTO_STATUS_TIMEZONE);
}

export function isFutureDueDate(dueDateIso: string, todayIso = getTodayIsoInKathmandu()): boolean {
  return dueDateIso > todayIso;
}

export function shouldAutoManageStatus(type: TransactionType): boolean {
  return type === 'deposit' || type === 'withdrawal';
}

export function getAllowedStatusesForType(type: TransactionType): TransactionStatus[] {
  return ALLOWED_STATUSES_BY_TYPE[type];
}

export function getAutomaticStatusForType(
  type: TransactionType,
  dueDateIso: string,
  todayIso = getTodayIsoInKathmandu(),
): TransactionStatus {
  if (type === 'cheque') {
    return isFutureDueDate(dueDateIso, todayIso) ? 'pending' : 'deducted';
  }

  if (type === 'deposit') {
    return dueDateIso <= todayIso ? 'cleared' : 'pending';
  }

  if (type === 'withdrawal') {
    return dueDateIso <= todayIso ? 'deducted' : 'pending';
  }

  return 'pending';
}

export function coerceTransactionStatus(params: {
  type: TransactionType;
  dueDateIso: string;
  status: TransactionStatus;
  todayIso?: string;
}): TransactionStatus {
  const { type, dueDateIso, status, todayIso } = params;
  const resolvedTodayIso = todayIso ?? getTodayIsoInKathmandu();

  if (type === 'cheque') {
    if (isFutureDueDate(dueDateIso, resolvedTodayIso)) {
      return 'pending';
    }

    return status === 'cleared' ? 'cleared' : 'deducted';
  }

  if (shouldAutoManageStatus(type)) {
    return getAutomaticStatusForType(type, dueDateIso, resolvedTodayIso);
  }

  return ALLOWED_STATUSES_BY_TYPE.cheque.includes(status) ? status : 'pending';
}

export function getChequeStatusOptionsForDueDate(
  dueDateIso: string,
  todayIso = getTodayIsoInKathmandu(),
): TransactionStatus[] {
  return isFutureDueDate(dueDateIso, todayIso)
    ? ['pending']
    : [...PAST_OR_TODAY_CHEQUE_STATUSES];
}

export function getTransactionStatusLabel(type: TransactionType, status: TransactionStatus): string {
  if (type === 'deposit' && status === 'cleared') {
    return 'Deposited';
  }

  return STATUS_LABELS[status];
}

export function getStatusFilterOptions(type: TransactionType | 'all'): Array<{
  value: TransactionStatus;
  label: string;
}> {
  if (type === 'deposit') {
    return [
      { value: 'pending', label: 'Pending' },
      { value: 'cleared', label: 'Deposited' },
    ];
  }

  if (type === 'withdrawal') {
    return [
      { value: 'pending', label: 'Pending' },
      { value: 'deducted', label: 'Deducted' },
    ];
  }

  if (type === 'cheque') {
    return [
      { value: 'pending', label: 'Pending' },
      { value: 'deducted', label: 'Deducted' },
      { value: 'cleared', label: 'Cleared' },
    ];
  }

  return [
    { value: 'pending', label: 'Pending' },
    { value: 'deducted', label: 'Deducted' },
    { value: 'cleared', label: 'Cleared / Deposited' },
  ];
}

export function isStatusAllowedByTypeFilter(
  type: TransactionType | 'all',
  status: TransactionStatus | 'all',
): boolean {
  if (status === 'all' || type === 'all') {
    return true;
  }

  return getAllowedStatusesForType(type).includes(status);
}
