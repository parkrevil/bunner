import qs from 'qs';

export interface BodyParserOptions {
  maxBytes?: number;
  urlencodedOptions?: qs.IParseOptions;
}
