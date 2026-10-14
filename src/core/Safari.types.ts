interface IPushServiceSafariRequestPayload {
  application: string;
  hwid: string;
}

interface IPushServiceSafariInfo {
  permission: NotificationPermission;
  deviceToken?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Window {
  safari: {
    pushNotification: {
      permission(siteId: string): IPushServiceSafariInfo;
      requestPermission(
        url: string,
        id: string,
        payload: IPushServiceSafariRequestPayload,
        cb: (permission: IPushServiceSafariInfo) => void): void;
    };
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const safari: typeof window.safari;
