import { ContentType } from '../../constants';
import { BunnerRequest } from "../../request";

export class BodyParser {
  async parse(request: BunnerRequest) {
    const {
      raw,
      contentType,
    } = request;

    if (!raw.body) {
      return;
    }

    if (!contentType) {
      return raw.arrayBuffer();
    }

    if (contentType.includes(ContentType.Json)) {
      try {
        return raw.json();
      } catch {
        throw new Error('Invalid JSON body');
      }
    }

    if (contentType.startsWith('text/')) {
      try {
        return raw.text();
      } catch {
        throw new Error('Invalid text body');
      }
    }

    if (contentType.includes(ContentType.FormUrlencoded)) {
      try {
        return new URLSearchParams(await raw.text());
      } catch {
        throw new Error('Invalid form urlencoded body');
      }
    }

    if (contentType.includes(ContentType.MultipartFormData)) {
      try {
        return raw.formData();
      } catch {
        throw new Error('Invalid multipart/form-data body');
      }
    }

    if (contentType.includes(ContentType.OctetStream)) {
      return raw.blob();
    }

    return raw.arrayBuffer();
  }
}
