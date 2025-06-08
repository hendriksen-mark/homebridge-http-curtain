// Ensure NodeJS timer functions are available
import { setTimeout, clearTimeout } from 'timers';

export class PullTimer {

  log: any;
  interval: number;
  private handler: (cb: (error: Error | null, value?: unknown) => void) => void;
  private successHandler: (value: unknown) => void;
  private timeout?: ReturnType<typeof setTimeout>;

  constructor(
    log: any,
    interval: number,
    handler: ((cb: (error: Error | null, value?: unknown) => void) => void),
    successHandler: ((value: unknown) => void),
  ) {
    this.log = log;
    this.interval = interval;
    this.handler = handler;
    this.successHandler = successHandler;
  }

  start() {
    if (!this.timeout) {
      this.timeout = setTimeout(this.handleTimer.bind(this), this.interval);
    } else if (typeof (this.timeout as any).refresh === 'function') {
      (this.timeout as any).refresh();
    } else {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(this.handleTimer.bind(this), this.interval);
    }
  }

  resetTimer() {
    if (!this.timeout) {
      return;
    }

    if (typeof (this.timeout as any).refresh === 'function') {
      (this.timeout as any).refresh();
    } else {
      clearTimeout(this.timeout);
      this.timeout = setTimeout(this.handleTimer.bind(this), this.interval);
    }
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = undefined;
  }

  private handleTimer() {
    this.handler(once((error: Error | null, value?: unknown) => {
      if (error) {
        this.log('Error occurred while pulling update from curtain: ' + error.message);
      } else {
        this.successHandler(value);
      }

      this.resetTimer();
    }));
  }

}

export function once(func: Function) {
  let called = false;

  return (...args: any[]) => {
    if (called) {
      throw new Error('This callback function has already been called by someone else; it can only be called one time.');
    } else {
      called = true;
      return func(...args);
    }
  };
}