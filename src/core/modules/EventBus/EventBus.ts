import { type EventHandlerMap, type EventName } from '../../events.types';
import { isFunction, v4 } from '../../functions';

type SavedEventHandlersMap = {
  // TODO: fix me: https://github.com/microsoft/TypeScript/issues/36390
  // [K in keyof EventHandlerMap]?: Array<EventHandlerMap[K]>
  [K in keyof EventHandlerMap]?: Array<unknown>
};

export class EventBus {
  private readonly handlers: SavedEventHandlersMap;

  constructor() {
    this.handlers = {};
  }

  public addEventHandler = <Name extends EventName = EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => {
    let savedEventHandlers = this.handlers[name];
    if (!savedEventHandlers) {
      savedEventHandlers = [];
    }

    savedEventHandlers.push(handler);
    this.handlers[name] = savedEventHandlers;
  };

  public removeEventHandler = <Name extends EventName = EventName>(
    name: Name,
    handler: EventHandlerMap[Name],
  ): void => {
    const savedEventHandlers = this.handlers[name];
    if (!savedEventHandlers) {
      return;
    }

    this.handlers[name] = savedEventHandlers.filter((savedEventHandler) => (
      savedEventHandler !== handler
    ));
  };

  public dispatchEvent = <Name extends EventName = EventName>(
    name: Name,
    payload: Omit<Parameters<EventHandlerMap[Name]>[0], 'eventId'> & { eventId?: string },
  ): string => {
    const eventId = payload.eventId || v4();
    const savedEventHandlers = this.handlers[name];
    if (!savedEventHandlers) {
      return eventId;
    }

    savedEventHandlers.forEach((handler) => {
      if (!isFunction(handler)) {
        return;
      }

      setTimeout(() => {
        handler({ ...payload, eventId });
      }, 0);
    });

    return eventId;
  };
}
