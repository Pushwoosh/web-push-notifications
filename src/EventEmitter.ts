type ListenerFn = (...args: Array<any>) => void | Promise<any>;

class EventEmitter {
  private _events: {
    [key: string]: ListenerFn[]
  };
  constructor() {
    this._events = {};
  }

  emit(evt: string, param?: any) {
    const events = this._events[evt] && this._events[evt].slice();
    if (events && events.length) {
      for (let i = 0; i < events.length; i++) {
        events[i](param);
      }
    }
  }

  on(evt: string, fn: ListenerFn) {
    if (!this._events[evt]) {
      this._events[evt] = [];
    }
    this._events[evt].push(fn);
    return this;
  }

  once(evt: string, fn: ListenerFn) {
    let used = false;
    const oncefun = (param: any) => {
      if (!used) {
        used = true;
        this.removeListener(evt, oncefun);
        return fn(param);
      }
    };
    return this.on(evt, oncefun);
  }

  removeListener(evt: string, listener: ListenerFn) {
    const events = this._events[evt];
    if (events) {
      const idx = events.indexOf(listener);
      if (idx > -1) {
        events.splice(idx, 1);
      }
      if (events.length < 1) {
        delete this._events[evt];
      }
    }
  }
}


export default EventEmitter;
