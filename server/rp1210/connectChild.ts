// Child-process entry: attempts RP1210_ClientConnect then immediately disconnects.
// Run in isolation because vendor DLLs (managed/.NET) can raise unhandled CLR exceptions
// that would kill the host process. READ-ONLY: no SendMessage / SendCommand is ever used.
// Usage: node <loader> connectChild.ts <vendorId> <deviceId> <protocol>
// Prints one JSON line on stdout: {ok, clientId?|errorCode?, message}
import { loadRp1210 } from "./api";

async function main(): Promise<void> {
  const [vendorId, deviceArg, protocol] = process.argv.slice(2);
  const deviceId = Number(deviceArg);
  const api = await loadRp1210(vendorId);
  const rc = api.ClientConnect(null, deviceId, protocol, 8192, 8192, 0);
  if (rc >= 0 && rc <= 127) {
    const dr = api.ClientDisconnect(rc);
    process.stdout.write(JSON.stringify({ ok: true, clientId: rc, message: `Connected; disconnect -> ${dr}: ${api.getErrorMsg(dr)}` }) + "\n");
  } else {
    process.stdout.write(JSON.stringify({ ok: false, errorCode: rc, message: api.getErrorMsg(rc) }) + "\n");
  }
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, message: (e as Error).message }) + "\n");
  process.exit(1);
});
