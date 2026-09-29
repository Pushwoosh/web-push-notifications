import {
  MILLISECONDS_IN_HOUR,
  MILLISECONDS_IN_DAY,
  MONTHS,
} from './constants';

export function isElementFixed(element: HTMLElement): boolean {
  let isFixed = window.getComputedStyle(element).position === 'fixed';
  if (!isFixed && element.parentElement) {
    isFixed = isElementFixed(element.parentElement);
  }
  return isFixed;
}

// `sendDate` is a real UTC instant now, so the shift that used to undo an
// equal one in `publicMessageBuilder` is gone.
export function getMessageTime(date: string): string {
  const localDate = new Date(date);
  const now = new Date();

  const gap = (now.getTime() - localDate.getTime());

  if (gap <= 60 * 1000) {
    return `Just now`;
  } else if (gap < MILLISECONDS_IN_HOUR && gap > 0) {
    const minutesAgo = Math.floor(gap / (60 * 1000));
    return `${minutesAgo} minutes ago`;
  } else if (gap < MILLISECONDS_IN_DAY && gap > 0) {
    const hoursAgo = Math.floor(gap / (60 * 60 * 1000));
    return `${hoursAgo} hours ago`;
  }

  const day = localDate.getDate();
  const month = MONTHS[localDate.getMonth()];
  const year = localDate.getFullYear();
  const hours = localDate.getHours();
  const minutes = `0${localDate.getMinutes().toString()}`.slice(-2); // padStart(2, 0)

  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

// Newest first. The timezone shift the two dates used to go through cancelled
// out for a comparison anyway, and is gone with the one in `getMessageTime`.
export function compareBySendDate(dateOne: string, dateTwo: string): number {
  return new Date(dateTwo).getTime() - new Date(dateOne).getTime();
}
