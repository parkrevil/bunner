export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  capacity?: number;
  headers?: boolean;
  statusCode?: number;
}

export interface LRUNode {
  /**
   * shared: two Int32 values in one Int32Array:
   *  [0] = expireSec (unix seconds when this slot expires)
   *  [1] = count
   * SharedInt32Array (length >= 2)
   */
  shared: Int32Array;
  key: string;
  prev?: LRUNode;
  next?: LRUNode;
}
