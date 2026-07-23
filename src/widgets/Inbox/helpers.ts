import {
  MILLISECONDS_IN_HOUR,
  MILLISECONDS_IN_DAY,
  MONTHS,
  COLOR_TEST_REGEXP,
} from './constants';

export function isElementFixed(element: HTMLElement): boolean {
  let isFixed = window.getComputedStyle(element).position === 'fixed';
  if (!isFixed && element.parentElement) {
    isFixed = isElementFixed(element.parentElement);
  }
  return isFixed;
}

export function getMessageTime(date: string): string {
  const localDate = new Date(date);
  const localTime = localDate.getHours() + (localDate.getTimezoneOffset() / 60);
  localDate.setHours(localTime);
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

export function getValidColor(color: string): string {
  if (color === 'transparent') {
    return color;
  }

  return COLOR_TEST_REGEXP.test(color)
    ? color
    : '#333';
}

export function compareBySendDate(dateOne: string, dateTwo: string): number {
  const localDateOne = new Date(dateOne);
  const localTimeOne = localDateOne.getHours() + (localDateOne.getTimezoneOffset() / 60);
  const localDateTwo = new Date(dateTwo);
  const localTimeTwo = localDateTwo.getHours() + (localDateTwo.getTimezoneOffset() / 60);

  localDateOne.setHours(localTimeOne);
  localDateTwo.setHours(localTimeTwo);

  return localDateTwo.getTime() - localDateOne.getTime();
}
