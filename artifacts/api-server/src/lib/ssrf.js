import dns from "dns/promises";
import net from "net";

const BLOCKED_RANGES = [
// Loopback
{ start: "127.0.0.0", end: "127.255.255.255" },
// Private class A
{ start: "10.0.0.0", end: "10.255.255.255" },
// Private class B
{ start: "172.16.0.0", end: "172.31.255.255" },
// Private class C
{ start: "192.168.0.0", end: "192.168.255.255" },
// Link-local
{ start: "169.254.0.0", end: "169.254.255.255" }
// IPv6 loopback / link-local handled by string check
];

function ipToLong(ip) {
  return (
    ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>>
    0);

}

function isPrivateIp(ip) {
  // Handle IPv6 loopback and link-local
  if (ip === "::1" || ip.startsWith("fe80") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }

  // Handle IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ipv4 = v4Mapped ? v4Mapped[1] : ip;

  if (!net.isIPv4(ipv4)) return false;

  const num = ipToLong(ipv4);
  for (const range of BLOCKED_RANGES) {
    if (num >= ipToLong(range.start) && num <= ipToLong(range.end)) {
      return true;
    }
  }
  return false;
}

export class SsrfError extends Error {
  constructor(message) {
    super(message);
    this.name = "SsrfError";
  }
}

export async function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError("URL must use http or https protocol");
  }

  const hostname = parsed.hostname;

  // Block localhost by name
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new SsrfError("URL targets a blocked hostname");
  }

  // Resolve DNS and check all returned IPs
  let addresses;
  try {
    addresses = await dns.resolve(hostname);
  } catch {
    // If DNS fails to resolve, try lookup
    try {
      const result = await dns.lookup(hostname, { all: true });
      addresses = result.map((r) => r.address);
    } catch {
      throw new SsrfError(`Could not resolve hostname: ${hostname}`);
    }
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new SsrfError(
        `URL resolves to a private/reserved IP address: ${addr}`
      );
    }
  }

  return parsed;
}