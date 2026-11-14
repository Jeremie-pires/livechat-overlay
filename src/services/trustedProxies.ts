// Proxies allowed to set X-Forwarded-For. Fastify walks the header from the right and stops at the
// first address outside this list, so a header forged by a client is never used as its IP.
// A hop count (`trustProxy: 1`) does not work here: Fastify 5 then ignores X-Forwarded-For and every
// request gets the Docker gateway address, which made the rate limit one bucket shared by all users.

// Loopback, and the Docker bridge networks that docker-proxy forwards from.
const LOCAL_PROXIES = ['127.0.0.1/8', '::1/128', '172.16.0.0/12'];

// Source: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6 (fetched 2026-11-14).
const CLOUDFLARE_PROXIES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

export const TRUSTED_PROXIES = [...LOCAL_PROXIES, ...CLOUDFLARE_PROXIES];
