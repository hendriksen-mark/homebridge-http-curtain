import { UrlObject } from './configParser';
import axios, { AxiosRequestConfig } from 'axios';

export type BodyReplacer = {
    searchValue: string,
    replacer: string,
}

export function httpRequest(urlObject: UrlObject, ...bodyReplacer: BodyReplacer[]) {
  let url = urlObject.url;
  let body = urlObject.body;
  let auth: { username: string, password: string } | undefined = undefined;

  if (urlObject.auth && urlObject.auth.username && urlObject.auth.password) {
    auth = {
      username: urlObject.auth.username,
      password: urlObject.auth.password,
    };
  }

  bodyReplacer.forEach(replacer => {
    url = url.replace(replacer.searchValue, replacer.replacer);
    if (body) {
      body = body.replace(replacer.searchValue, replacer.replacer);
    }
  });

  const axiosOptions: AxiosRequestConfig = {
    url,
    method: urlObject.method || 'GET',
    headers: urlObject.headers,
    auth: auth,
    timeout: urlObject.requestTimeout || 20000,
    data: body,
  };

  return axios(axiosOptions);
}
