import os from "node:os";

/** First non-internal IPv4 (Wi‑Fi / Ethernet) for phone testing on the same LAN. */
export function localLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return undefined;
}
