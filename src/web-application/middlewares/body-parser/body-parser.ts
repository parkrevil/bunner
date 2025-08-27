import { StatusCodes } from 'http-status-codes';
import { ContentType, textEncoder } from '../../constants';
import type { Middleware } from '../../providers/middleware';
import type { BodyParserOptions } from './interfaces';
import type { BodyType } from './types';

const BODY_TYPE: Record<BodyType, { test: (ct: string | undefined) => boolean; parse: (raw: Request) => Promise<any> }> = {
  json: {
    test: (ct) => !!ct && ct.includes(ContentType.Json),
    parse: parseJson,
  },
  text: {
    test: (ct) => !!ct && ct.startsWith('text/'),
    parse: parseText,
  },
  'form-urlencoded': {
    test: (ct) => !!ct && ct.includes(ContentType.FormUrlencoded),
    parse: parseFormUrlencoded,
  },
  'multipart-formdata': {
    test: (ct) => !!ct && ct.includes(ContentType.MultipartFormData),
    parse: parseMultipartFormData,
  },
  'octet-stream': {
    test: (ct) => !!ct && ct.includes(ContentType.OctetStream),
    parse: parseBlob,
  },
  blob: {
    test: (ct) => !!ct && ct.includes(ContentType.OctetStream),
    parse: parseBlob,
  },
  arraybuffer: {
    test: (ct) => !ct,
    parse: parseArrayBuffer,
  },
};

export function bodyParser(allowed: BodyType[], options: BodyParserOptions = {}): Middleware {
  const pipelines = allowed.map((type) => BODY_TYPE[type]);
  const maxBytes = typeof options.maxBytes === 'number' && options.maxBytes > 0 ? options.maxBytes : undefined;

  return async (req, res) => {
    if (!req.raw.body) {
      return;
    }

    const contentType = req.contentType;

    if (maxBytes && typeof req.contentLength === 'number' && req.contentLength > maxBytes) {
      return res.setStatus(StatusCodes.REQUEST_TOO_LONG);
    }

    if (pipelines.length === 0) {
      return res.setStatus(StatusCodes.UNSUPPORTED_MEDIA_TYPE);
    }

    for (let i = 0; i < pipelines.length; i++) {
      try {
        const entry = pipelines[i]!;

        if (!entry.test(contentType)) {
          continue;
        }

        const parsed = await entry.parse(req.raw);

        if (maxBytes) {
          let size = 0;

          if (typeof parsed === 'string') {
            size = textEncoder.encode(parsed).byteLength;
          } else if (parsed instanceof Blob) {
            size = parsed.size;
          } else if (parsed instanceof ArrayBuffer) {
            size = parsed.byteLength;
          } else if (parsed instanceof Uint8Array) {
            size = parsed.byteLength;
          } else {
            size = JSON.stringify(parsed).length;
          }

          if (size > maxBytes) {
            return res.setStatus(StatusCodes.REQUEST_TOO_LONG);
          }
        }

        req.setBody(parsed);

        return;
      } catch (e) {
        continue;
      }
    }

    return res.setStatus(StatusCodes.UNSUPPORTED_MEDIA_TYPE);
  };
}

function parseJson(raw: Request) {
  return raw.json();
}

function parseText(raw: Request) {
  return raw.text();
}

async function parseFormUrlencoded(raw: Request) {
  return new URLSearchParams(await raw.text());
}

async function parseMultipartFormData(raw: Request) {
  return raw.formData();
}

function parseBlob(raw: Request) {
  return raw.blob();
}

function parseArrayBuffer(raw: Request) {
  return raw.arrayBuffer();
}
