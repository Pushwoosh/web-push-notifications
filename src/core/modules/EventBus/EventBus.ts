import { v4 } from 'uuid';

type SavedEventHandlersMap = {
  // TODO: fix me: https://github.com/microsoft/TypeScript/issues/36390
  // [K in keyof EventHandlerMap]?: Array<EventHandlerMap[K]>
  [K in keyof EventHandlerMap]?: Array<unknown>
};

export class EventBus {
  private readonly savedEventHandlersMap: SavedEventHandlersMap;

  constructor() {
    this.savedEventHandlersMap = {};
  }

  public addEventHandler = <Name extends EventName = EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => {
    let savedEventHandlers = this.savedEventHandlersMap[name];
    if (!savedEventHandlers) {
      savedEventHandlers = [];
    }

    savedEventHandlers.push(handler);
    this.savedEventHandlersMap[name] = savedEventHandlers;
  }

  public removeEventHandler = <Name extends EventName = EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => {
    const savedEventHandlers = this.savedEventHandlersMap[name];
    if (!savedEventHandlers) {
      return;
    }

    this.savedEventHandlersMap[name] = savedEventHandlers.filter((savedEventHandler) => (
      savedEventHandler !== handler
    ));
  }

  public dispatchEvent = <Name extends EventName = EventName>(
    name: Name,
    payload: Omit<Parameters<EventHandlerMap[Name]>[0], 'eventId'> & { eventId?: string },
  ): string => {
    const eventId = payload.eventId || v4();
    const savedEventHandlers = this.savedEventHandlersMap[name];
    if (!savedEventHandlers) {
      return eventId;
    }

    savedEventHandlers.forEach((element) => {
      if (typeof element !== 'function') {
        return;
      }

      setTimeout(() => {
        element({ ...payload, eventId });
      }, 0);
    });

    return eventId;
  }
}
