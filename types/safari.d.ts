interface Window {
  safari: {
    pushNotification: {
      permission: (siteId: string) => 'granted' | 'denied' | 'default';
    }
  };
}
declare const safari: typeof window.safari;
