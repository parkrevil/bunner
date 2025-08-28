import type { Middleware } from '../../providers/middleware';
import type { HppOptions } from './interfaces';

function processHPP(
  data: Record<string, any>,
  options: Required<HppOptions>,
  depth = 0
): Record<string, any> {
  if (!data || (options.depth !== undefined && depth > options.depth)) {
    return data;
  }

  Object.keys(data).forEach(key => {
    let val = data[key];

    if (Array.isArray(val)) {
      if (options.whitelist.includes(key)) {
        val = val.map(item => (item && typeof item === 'object' ? processHPP(item, options, depth + 1) : item));
      } else {
        val = options.keepValue === 'first' ? val[0] : val[val.length - 1];
        val = val && typeof val === 'object' ? processHPP(val, options, depth + 1) : val;
      }
    } else if (val && typeof val === 'object') {
      val = processHPP(val, options, depth + 1);
    }

    data[key] = val;
  });

  return data;
}

export function hpp(options?: HppOptions): Middleware {
  const hppOptions: Required<HppOptions> = {
    target: options?.target ?? 'queryParams',
    keepValue: options?.keepValue ?? 'last',
    depth: options?.depth ?? 0,
    whitelist: Array.from((options?.whitelist ? new Set(options.whitelist) : new Set()).values()) as string[],
  };

  return (req, res) => {
    if (hppOptions.target === 'queryParams' && req.queryParams) {
      req.setQueryParams(processHPP(req.queryParams, hppOptions));
    }

    if (hppOptions.target === 'body' && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.setBody(processHPP(req.body, hppOptions));
    }
  };
}
