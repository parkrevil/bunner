import { ContentType } from '../../constants';
import type { Middleware } from '../../providers/middleware';
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

export function bodyParser(allowed: BodyType[]): Middleware {
  const pipelines = allowed.map((type) => BODY_TYPE[type]);

  return async (req, res) => {
    if (!req.raw.body) {
      return;
    }

    const contentType = req.contentType;

    if (pipelines.length === 0) {
      return res.setStatus(415);
    }

    for (let i = 0; i < pipelines.length; i++) {
      try {
        const entry = pipelines[i]!;

        if (!entry.test(contentType)) {
          continue;
        }

        req.setBody(await entry.parse(req.raw));

        return;
      } catch (e) {
        continue;
      }
    }

    return res.setStatus(415);
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
