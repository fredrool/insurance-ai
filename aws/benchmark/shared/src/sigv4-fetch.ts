import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';

const SIGV4_SERVICE = 'bedrock-agentcore';

export function createSigV4Fetch(region: string): typeof fetch {
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: SIGV4_SERVICE,
    sha256: Sha256,
  });

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(input.url);

    const method = init?.method?.toUpperCase() ?? 'GET';
    const headers = new Headers(init?.headers ?? undefined);
    if (!headers.has('host')) {
      headers.set('host', requestUrl.host);
    }

    const body = init?.body;
    const bodyText =
      body === undefined || body === null
        ? undefined
        : typeof body === 'string'
          ? body
          : body instanceof Uint8Array
            ? new TextDecoder().decode(body)
            : await new Response(body).text();

    const headerRecord: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerRecord[key] = value;
    });

    const signedRequest = await signer.sign(
      new HttpRequest({
        method,
        protocol: requestUrl.protocol,
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        headers: headerRecord,
        body: bodyText,
      }),
    );

    const signedHeaders = new Headers();
    for (const [key, value] of Object.entries(signedRequest.headers)) {
      if (value !== undefined) {
        signedHeaders.set(key, value);
      }
    }

    return fetch(requestUrl, {
      ...init,
      method,
      headers: signedHeaders,
      body: bodyText ?? init?.body,
    });
  };
}