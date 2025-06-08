// ISC License
// Original work Copyright (c) 2017, Andreas Bauer
// Modified work Copyright 2020, Sander van Woensel
// Updated work Copyright 2025, Mark Hendriksen

'use strict';

// -----------------------------------------------------------------------------
// Module variables
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

import { parseUrlProperty } from './configParser';
import { httpRequest } from './http';
import PACKAGE_JSON from '../package.json';
import { setTimeout, clearTimeout } from 'timers';

// Homebridge types (install @homebridge/types for best results)
import type { API, Logging } from 'homebridge';

const MANUFACTURER: string = PACKAGE_JSON.author.name;
const SERIAL_NUMBER = '001';
const MODEL: string = PACKAGE_JSON.name;
const FIRMWARE_REVISION: string = PACKAGE_JSON.version;

let Service: any, Characteristic: any;

interface HttpCurtainConfig {
    name: string;
    getCurrentPosUrl: string;
    getPositionStateUrl?: string;
    setTargetPosUrl: string;
    getTargetPosUrl?: string;
    identifyUrl?: string;
    getCurrentPosRegEx?: string;
    getTargetPosRegEx?: string;
    pullInterval?: number;
    invertPosition?: boolean;
    notificationID?: string;
    notificationPassword?: string;
};

// Use export default for ESM compatibility
const plugin = (api: API) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  // Register using a wrapper to adapt Homebridge's AccessoryConfig to our HttpCurtainConfig
  api.registerAccessory(MODEL, 'HttpCurtain', class extends HttpCurtain {
    constructor(log: Logging, config: any, api: API) {
      // Optionally, validate config here or map fields as needed
      super(log, config as HttpCurtainConfig, api);
    }
  });
};

class HttpCurtain {
  log: Logging;
  name: string;
  targetPosition: number;
  getCurrentPosUrl: any;
  getPositionStateUrl: any;
  setTargetPosUrl: any;
  getTargetPosUrl: any;
  identifyUrl: any;
  getCurrentPosRegEx: string;
  getTargetPosRegEx: string;
  homebridgeService: any;
  pullInterval?: number;
  invertPosition: boolean;
  pullTimer?: any;

  constructor(log: Logging, config: HttpCurtainConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.targetPosition = 0;

    this.getCurrentPosUrl = undefined;
    this.getPositionStateUrl = undefined;
    this.setTargetPosUrl = undefined;
    this.getTargetPosUrl = undefined;
    this.identifyUrl = undefined;

    this.validateUrl('getCurrentPosUrl', config, true);
    this.validateUrl('getPositionStateUrl', config);
    this.validateUrl('setTargetPosUrl', config, true);
    this.validateUrl('getTargetPosUrl', config);
    this.validateUrl('identifyUrl', config);

    this.getCurrentPosRegEx = config.getCurrentPosRegEx || '';
    this.getTargetPosRegEx = config.getTargetPosRegEx || '';

    this.homebridgeService = new Service.WindowCovering(this.name);

    this.pullInterval = config.pullInterval;

    if (this.pullInterval) {
      this.startPullTimer();
    }

    this.invertPosition = config.invertPosition || false;

    if (api && api.on) {
      api.on('didFinishLaunching', () => {
        const globalObj: any = globalThis as any;
        if (globalObj.notificationRegistration && typeof globalObj.notificationRegistration === 'function') {
          try {
            globalObj.notificationRegistration(config.notificationID, this.handleNotification.bind(this), config.notificationPassword);
          } catch {
            // notificationID is already taken.
          }
        }
      });
    }
  }

  validateUrl(url: string, config: any, mandatory = false) {
    const value = config[url];
    if (
      (typeof value.url === 'string' && value.url.trim() !== '')
    ) {
      try {
        (this as any)[url] = parseUrlProperty(value);
      } catch (error: any) {
        this.log.warn(`Error occurred while parsing '${url}': ${error.message}`);
        this.log.warn('Aborting...');
        return;
      }
    } else if (mandatory) {
      this.log.warn(`Property '${url}' is required!`);
      this.log.warn('Aborting...');
      return;
    } else {
      // Optional URL missing or not a non-empty string/object with url, just skip
      (this as any)[url] = undefined;
    }
  }

  identify = async (): Promise<void> => {
    this.log.info('Identify requested');
    if (this.identifyUrl) {
      try {
        const response = await httpRequest(this.identifyUrl);
        if (response.status !== 200) {
          this.log.error('identify() returned http error: %s', response.status);
          throw new Error('Got http error code ' + response.status);
        }
      } catch (error: any) {
        this.log.error('identify() failed: %s', error.message);
        throw error;
      }
    }
    // else just resolve
  }

  getServices(): any[] {
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, MANUFACTURER)
      .setCharacteristic(Characteristic.Model, MODEL)
      .setCharacteristic(Characteristic.SerialNumber, SERIAL_NUMBER)
      .setCharacteristic(Characteristic.FirmwareRevision, FIRMWARE_REVISION);

    this.homebridgeService
      .getCharacteristic(Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition);

    this.homebridgeService
      .getCharacteristic(Characteristic.PositionState)
      .onGet(this.getPositionState);

    this.homebridgeService
      .getCharacteristic(Characteristic.TargetPosition)
      .onGet(this.getTargetPosition)
      .onSet(this.setTargetPosition);

    return [informationService, this.homebridgeService];
  }

  handleNotification = (body: any) => {
    const value = body.value;
    let characteristic;
    switch (body.characteristic) {
      case 'CurrentPosition':
        characteristic = Characteristic.CurrentPosition;
        break;
      case 'PositionState':
        characteristic = Characteristic.PositionState;
        break;
      default:
        this.log.warn('Encountered unknown characteristic handling notification: ' + body.characteristic);
        return;
    }
    this.log.debug('Update received from device: ' + body.characteristic + ': ' + body.value);
    this.homebridgeService.setCharacteristic(characteristic, value);
  }

  startPullTimer() {
    if (!this.pullTimer && this.pullInterval) {
      this.pullTimer = setTimeout(() => this.handlePullTimer(), this.pullInterval);
    }
  }

  resetPullTimer() {
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
      this.pullTimer = undefined;
    }
    this.startPullTimer();
  }

  stopPullTimer() {
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
      this.pullTimer = undefined;
    }
  }

  private handlePullTimer() {
    this.getCurrentPosition()
      .then(value => {
        this.homebridgeService.setCharacteristic(Characteristic.CurrentPosition, value);
      })
      .catch(error => {
        this.log('Error occurred while pulling update from curtain: ' + error.message);
      })
      .finally(() => {
        this.resetPullTimer();
      });
  }

  getCurrentPosition = async (): Promise<number> => {
    try {
      const response = await httpRequest(this.getCurrentPosUrl);
      if (this.pullInterval) {
        this.resetPullTimer();
      }
      if (response.status !== 200) {
        this.log.error('getCurrentPosition() returned http error: %s', response.status);
        throw new Error('Got http error code ' + response.status);
      }
      let body = response.data;
      if (this.getCurrentPosRegEx) {
        let matches = body.match(this.getCurrentPosRegEx);
        if (matches && matches.length > 1) {
          body = matches[1];
          this.log.debug('Retrieving current position via regular expression. Full ungrouped match: %s', matches[0]);
        } else {
          this.log.warn('Your CurrentPosRegEx regular expression: "%s" did not match any part of the returned body: "%s"', this.getCurrentPosRegEx, body);
        }
      }
      let posValue = parseInt(body);
      this.log.info('Current position (retrieved via http): %s', posValue);

      if (this.invertPosition) {
        posValue = 100 - posValue;
      }

      return posValue;
    } catch (error: any) {
      this.log.error('getCurrentPosition() failed: %s', error.message);
      throw error;
    }
  }

  getPositionState = async (): Promise<number> => {
    if (this.getPositionStateUrl) {
      try {
        const response = await httpRequest(this.getPositionStateUrl);
        if (this.pullInterval) {
          this.resetPullTimer();
        }
        if (response.status !== 200) {
          this.log.error('getPositionState() returned http error: %s', response.status);
          throw new Error('Got http error code ' + response.status);
        }
        const state = parseInt(response.data);
        this.log.info('Position state: %s', state);
        return state;
      } catch (error: any) {
        this.log.error('getPositionState() failed: %s', error.message);
        throw error;
      }
    } else {
      this.log.debug('Position state URL not configured. Returning: Stopped (' + Characteristic.PositionState.STOPPED + ')');
      return Characteristic.PositionState.STOPPED;
    }
  }

  setTargetPosition = async (value: number): Promise<void> => {
    this.targetPosition = value;

    if (this.invertPosition) {
      value = 100 - value;
    }

    let urlObj = { ...this.setTargetPosUrl };
    urlObj.url = urlObj.url.replace(/%d/g, value.toString());
    urlObj.body = urlObj.body.replace(/%d/g, value.toString());
    this.log.info('Requesting: %s for value: %d', urlObj.url, value);

    try {
      const response = await httpRequest(urlObj);
      if (response.status !== 200) {
        this.log.error('setTargetPositionUrl() returned http error: %s; body: %s', response.status, response.data);
        throw new Error('Got http error code ' + response.status);
      }
      this.log.debug('Succesfully requested target position: %d', value);
    } catch (error: any) {
      this.log.error('setTargetPositionUrl() failed: %s', error.message);
      throw error;
    }
  }

  getTargetPosition = async (): Promise<number> => {
    if (this.getTargetPosUrl) {
      try {
        const response = await httpRequest(this.getTargetPosUrl);
        if (response.status !== 200) {
          this.log.error('getTargetPosition() returned http error: %s', response.status);
          throw new Error('Got http error code ' + response.status);
        }
        let body = response.data;
        if (this.getTargetPosRegEx) {
          let matches = body.match(this.getTargetPosRegEx);
          if (matches && matches.length > 1) {
            body = matches[1];
            this.log.debug('Retrieving target position via regular expression. Full ungrouped match: %s', matches[0]);
          } else {
            this.log.warn('Your TargetPosRegEx regular expression: "%s" did not match any part of the returned body: "%s"', this.getTargetPosRegEx, body);
          }
        }

        let targetPosition = parseInt(body);
        this.log.info('Target position (retrieved via http): %s', targetPosition);

        if (this.invertPosition) {
          targetPosition = 100 - targetPosition;
        }

        return targetPosition;
      } catch (error: any) {
        this.log.error('getTargetPosition() failed: %s', error.message);
        throw error;
      }
    } else {
      this.log.info('Target position (retrieved from cache): %s', this.targetPosition);
      return this.targetPosition;
    }
  }
}

export default plugin;