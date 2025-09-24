export interface ClientIpOptions {
  trustProxy?: boolean;
}

export interface ClientIpsResult {
  ip: string | undefined;
  ips: string[] | undefined;
}
