export type Credentials = {
    username?: string,
    password?: string,
    sendImmediately?: boolean
}

export class UrlObject {
  url: string;
  method: string = 'GET';
  body: string = '';
  repeat: number = 1;
  delayBeforeExecution: number = 0;
  auth: Credentials = {
    username: undefined,
    password: undefined,
    sendImmediately: true,
  };

  headers: Record<string, string> = {};
  strictSSL: boolean = false;
  requestTimeout: number = 20000; // default 20s timeout

  constructor(url: string) {
    this.url = url;
  }
}

export type HeaderKeyValues = {
    key: string,
    value: string,
}

/* ------------------------------------------ */

export function parseUrlProperty(property: any) {
  if (typeof property === 'object' && property.constructor === Array) {
    throw new Error('property cannot be an array!');
  }
  property = property as Partial<UrlObject>;

  const array = parseMultipleUrlProperty(property);
  return array[0];
}

export function parseMultipleUrlProperty(property: any): UrlObject[] {
  let array: UrlObject[] = [];

  if (typeof property === 'string') {
    array.push(new UrlObject(property));
  } else if (typeof property === 'object') {
    if (property.constructor === Array) {
      if (property.length === 0) {
        throw new Error('array cannot be empty');
      }

      for (let i = 0; i < property.length; i++) {
        const element = property[i];

        try {
          if (typeof element === 'object' && element.constructor === Object) {
            array.push(_parseUrlObject(element));
          } else if (typeof element === 'string') {
            array.push(new UrlObject(element));
          } else { // noinspection ExceptionCaughtLocallyJS
            throw new Error('Wrong data type. Expected string or object');
          }
        } catch (error) {
          throw new Error(`error caught on array element at index ${i}: ${(error as Error).message}`);
        }
      }
    } else if (property.constructor === Object) {
      array.push(_parseUrlObject(property)); // TODO accurate error message on throw
    }
  } else {
    throw new Error('property has an unsupported data type. Expected string, object or array');
  }

  return array;
}

function _parseUrlObject(property: any) {
  if (!property.url) {
    throw new Error('undefined \'url\' property!');
  }

  if (typeof property.url !== 'string') {
    throw new Error('\'url\' must be a string');
  }
  if (property.method !== undefined && typeof property.method !== 'string') {
    throw new Error('\'method\' must be a string!');
  }

  if (property.repeat !== undefined && typeof property.repeat !== 'number') {
    throw new Error('\'repeat\' must be a number!');
  }
  if (property.delayBeforeExecution !== undefined && typeof property.delayBeforeExecution !== 'number') {
    throw new Error('\'delayBefireExecution\' must be a number!');
  }

  if (property.auth !== undefined && !(property.auth.username && property.auth.password)) {
    throw new Error('\'auth.username\' and/or \'auth.password\' was not set!');
  }
  if (property.headers !== undefined) {
    if (typeof property.headers !== 'object') {
      throw new Error('\'auth.headers\' must be an object');
    }

    if (property.headers.constructor === Object) { // legacy style key value pairs
      const stringOnlyValues = Object.values(property.headers)
        .map(value => typeof value === 'string')
        .reduce((prev, cur) => prev && cur);

      if (!stringOnlyValues) {
        throw new Error('\'auth.headers\' must only contain key-value pairs of type string!');
      }
    } else if (property.headers.constructor === Array) { // object array style (engineered for homebridge config ui)
      const keyValueObjects = property.headers
        .map((pair: HeaderKeyValues) => pair.key !== undefined && pair.value !== undefined)
        .reduce((prev: boolean, cur: boolean) => prev && cur);

      if (!keyValueObjects) {
        throw new Error('\'auth.headers\' must only contain key-value pairs in proper object format!')
      }
    } else {
      throw new Error('\'auth.headers\' has unknown constructor');
    }
  }
  if (property.strictSSL !== undefined && typeof property.strictSSL !== 'boolean') {
    throw new Error('\'strictSSL\' must be a boolean!');
  }
  if (property.requestTimeout !== undefined && typeof property.requestTimeout !== 'number') {
    throw new Error('\'requestTimeout\' must be a number!');
  }

  let urlObject = new UrlObject(property.url);

  if (property.method) {
    urlObject.method = property.method;
  }

  if (property.body) {
    // TODO allow body only on certain http methods ?!?
    if (typeof property.body === 'string') {
      urlObject.body = property.body;
    } else {
      urlObject.body = JSON.stringify(property.body);
    }
  }

  if (property.repeat) {
    urlObject.repeat = Math.max(1, property.repeat);
  }
  if (property.delayBeforeExecution) {
    urlObject.delayBeforeExecution = property.delayBeforeExecution;
  }

  if (property.auth) {
    urlObject.auth.username = property.auth.username;
    urlObject.auth.password = property.auth.password;

    if (typeof (property.auth as any).sendImmediately === 'boolean') {
      urlObject.auth.sendImmediately = property.auth.sendImmediately;
    }
  }

  if (property.headers) {
    if (property.headers.constructor === Array) {
      const headers: Record<string, string> = {};
      property.headers.forEach((pair: HeaderKeyValues) => headers[pair.key] = pair.value);
      urlObject.headers = headers;
    } else {
      urlObject.headers = property.headers;
    }
  }

  if (property.strictSSL) {
    urlObject.strictSSL = property.strictSSL;
  }
  if (property.requestTimeout) {
    urlObject.requestTimeout = property.requestTimeout;
  }

  return urlObject
}