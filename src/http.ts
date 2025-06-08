import {UrlObject} from "./configParser";
import got, { OptionsOfTextResponseBody, Response as GotResponse } from "got";

export type BodyReplacer = {
    searchValue: string,
    replacer: string,
}

export type RequestCallback = (error: any, response?: any, body?: any) => void;

export function httpRequest(urlObject: UrlObject, callback: RequestCallback, ...bodyReplacer: BodyReplacer[]) {
    let url = urlObject.url;
    let body = urlObject.body;
    let auth: { username: string, password: string } | undefined = undefined;

    if (urlObject.auth && urlObject.auth.username && urlObject.auth.password) {
        auth = {
            username: urlObject.auth.username,
            password: urlObject.auth.password
        };
    }

    bodyReplacer.forEach(replacer => {
        url = url.replace(replacer.searchValue, replacer.replacer);
        if (body) {
            body = body.replace(replacer.searchValue, replacer.replacer);
        }
    });

    const method = urlObject.method || "GET";
    const options: OptionsOfTextResponseBody = {
        method: method as import("got").Method,
        headers: urlObject.headers,
        username: auth?.username,
        password: auth?.password,
        https: { rejectUnauthorized: urlObject.strictSSL !== false },
        timeout: { request: urlObject.requestTimeout || 20000 },
        // Only include body for non-GET methods
        ...(method !== "GET" && body ? { body } : {})
    };

    got(url, options)
        .then((response: GotResponse<string>) => {
            callback(null, {
                statusCode: response.statusCode,
                headers: response.headers,
            } as any, response.body);
        })
        .catch((error: any) => {
            callback(error, error.response, error.response?.body);
        });
}
