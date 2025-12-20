import { StatusCodes } from 'http-status-codes';

export class HttpError extends Error {
  statusCode: StatusCodes;

  constructor(statusCode: StatusCodes, message: string) {
    super(message);

    this.statusCode = statusCode;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request') {
    super(StatusCodes.BAD_REQUEST, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized') {
    super(StatusCodes.UNAUTHORIZED, message);
  }
}

export class PaymentRequiredError extends HttpError {
  constructor(message = 'Payment Required') {
    super(StatusCodes.PAYMENT_REQUIRED, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super(StatusCodes.FORBIDDEN, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found') {
    super(StatusCodes.NOT_FOUND, message);
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(message = 'Method Not Allowed') {
    super(StatusCodes.METHOD_NOT_ALLOWED, message);
  }
}

export class NotAcceptableError extends HttpError {
  constructor(message = 'Not Acceptable') {
    super(StatusCodes.NOT_ACCEPTABLE, message);
  }
}

export class ProxyAuthenticationRequiredError extends HttpError {
  constructor(message = 'Proxy Authentication Required') {
    super(StatusCodes.PROXY_AUTHENTICATION_REQUIRED, message);
  }
}

export class RequestTimeoutError extends HttpError {
  constructor(message = 'Request Timeout') {
    super(StatusCodes.REQUEST_TIMEOUT, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict') {
    super(StatusCodes.CONFLICT, message);
  }
}

export class GoneError extends HttpError {
  constructor(message = 'Gone') {
    super(StatusCodes.GONE, message);
  }
}

export class LengthRequiredError extends HttpError {
  constructor(message = 'Length Required') {
    super(StatusCodes.LENGTH_REQUIRED, message);
  }
}

export class PreconditionFailedError extends HttpError {
  constructor(message = 'Precondition Failed') {
    super(StatusCodes.PRECONDITION_FAILED, message);
  }
}

export class RequestTooLongError extends HttpError {
  constructor(message = 'Request Too Long') {
    super(StatusCodes.REQUEST_TOO_LONG, message);
  }
}

export class RequestUriTooLongError extends HttpError {
  constructor(message = 'Request URI Too Long') {
    super(StatusCodes.REQUEST_URI_TOO_LONG, message);
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor(message = 'Unsupported Media Type') {
    super(StatusCodes.UNSUPPORTED_MEDIA_TYPE, message);
  }
}

export class RequestedRangeNotSatisfiableError extends HttpError {
  constructor(message = 'Range Not Satisfiable') {
    super(StatusCodes.REQUESTED_RANGE_NOT_SATISFIABLE, message);
  }
}

export class ExpectationFailedError extends HttpError {
  constructor(message = 'Expectation Failed') {
    super(StatusCodes.EXPECTATION_FAILED, message);
  }
}

export class ImATeapotError extends HttpError {
  constructor(message = "I'm a teapot") {
    super(StatusCodes.IM_A_TEAPOT, message);
  }
}

export class MisdirectedRequestError extends HttpError {
  constructor(message = 'Misdirected Request') {
    super(StatusCodes.MISDIRECTED_REQUEST, message);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity') {
    super(StatusCodes.UNPROCESSABLE_ENTITY, message);
  }
}

export class LockedError extends HttpError {
  constructor(message = 'Locked') {
    super(StatusCodes.LOCKED, message);
  }
}

export class FailedDependencyError extends HttpError {
  constructor(message = 'Failed Dependency') {
    super(StatusCodes.FAILED_DEPENDENCY, message);
  }
}

export class UpgradeRequiredError extends HttpError {
  constructor(message = 'Upgrade Required') {
    super(StatusCodes.UPGRADE_REQUIRED, message);
  }
}

export class PreconditionRequiredError extends HttpError {
  constructor(message = 'Precondition Required') {
    super(StatusCodes.PRECONDITION_REQUIRED, message);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too Many Requests') {
    super(StatusCodes.TOO_MANY_REQUESTS, message);
  }
}

export class RequestHeaderFieldsTooLargeError extends HttpError {
  constructor(message = 'Request Header Fields Too Large') {
    super(StatusCodes.REQUEST_HEADER_FIELDS_TOO_LARGE, message);
  }
}

export class UnavailableForLegalReasonsError extends HttpError {
  constructor(message = 'Unavailable For Legal Reasons') {
    super(StatusCodes.UNAVAILABLE_FOR_LEGAL_REASONS, message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal Server Error') {
    super(StatusCodes.INTERNAL_SERVER_ERROR, message);
  }
}

export class NotImplementedError extends HttpError {
  constructor(message = 'Not Implemented') {
    super(StatusCodes.NOT_IMPLEMENTED, message);
  }
}

export class BadGatewayError extends HttpError {
  constructor(message = 'Bad Gateway') {
    super(StatusCodes.BAD_GATEWAY, message);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service Unavailable') {
    super(StatusCodes.SERVICE_UNAVAILABLE, message);
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor(message = 'Gateway Timeout') {
    super(StatusCodes.GATEWAY_TIMEOUT, message);
  }
}

export class HTTPVersionNotSupportedError extends HttpError {
  constructor(message = 'HTTP Version Not Supported') {
    super(StatusCodes.HTTP_VERSION_NOT_SUPPORTED, message);
  }
}

export class InsufficientStorageError extends HttpError {
  constructor(message = 'Insufficient Storage') {
    super(StatusCodes.INSUFFICIENT_STORAGE, message);
  }
}

export class NetworkAuthenticationRequiredError extends HttpError {
  constructor(message = 'Network Authentication Required') {
    super(StatusCodes.NETWORK_AUTHENTICATION_REQUIRED, message);
  }
}