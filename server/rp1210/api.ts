import type koffiNS from 'koffi';

export interface Rp1210Api {
  vendorId: string;
  ClientConnect(hwnd: null, deviceId: number, protocol: string, txSize: number, rxSize: number, appPacketizing: number): number;
  ClientDisconnect(clientId: number): number;
  SendMessage(clientId: number, msg: Buffer, size: number, notify: number, block: number): number;
  ReadMessage(clientId: number, buf: Buffer, size: number, block: number): number;
  SendCommand(cmd: number, clientId: number, data: Buffer | null, size: number): number;
  ReadVersionRaw(major: Buffer, minor: Buffer, apiMajor: Buffer, apiMinor: Buffer): void;
  ReadDetailedVersion(clientId: number, api: Buffer, dll: Buffer, fw: Buffer): number;
  GetErrorMsgRaw(code: number, buf: Buffer): number;
  GetHardwareStatus(clientId: number, buf: Buffer, size: number, block: number): number;
  getErrorMsg(code: number): string;
  readVersion(): { dllMajor: string; dllMinor: string; apiMajor: string; apiMinor: string };
}

const cstr = (b: Buffer): string => {
  const i = b.indexOf(0);
  return b.toString('latin1', 0, i < 0 ? b.length : i).trim();
};

// koffi is a native Windows addon that loads RP1210 vendor DLLs. It is imported lazily (dynamic
// import inside this function) so that merely importing this module at server boot never touches
// native code. That lets the cloud/serverless build (Vercel, Linux) start without crashing on a
// native module it can't load; koffi is only loaded when an RP1210 route is actually used, which
// happens only on a local Windows install with a physical adapter.
export async function loadRp1210(vendorId: string): Promise<Rp1210Api> {
  const koffi = (await import('koffi')).default as typeof koffiNS;
  const lib = koffi.load(vendorId + '.dll');
  const f = (sig: string) => lib.func(sig);
  const ClientConnect = f('short __stdcall RP1210_ClientConnect(void *hwnd, short nDeviceID, str fpchProtocol, long lTxBufferSize, long lRxBufferSize, short nIsAppPacketizingIncomingMsgs)');
  const ClientDisconnect = f('short __stdcall RP1210_ClientDisconnect(short nClientID)');
  const SendMessage = f('short __stdcall RP1210_SendMessage(short nClientID, void *fpchClientMessage, short nMessageSize, short nNotifyStatusOnTx, short nBlockOnSend)');
  const ReadMessage = f('short __stdcall RP1210_ReadMessage(short nClientID, void *fpchAPIMessage, short nBufferSize, short nBlockOnRead)');
  const SendCommand = f('short __stdcall RP1210_SendCommand(short nCommandNumber, short nClientID, void *fpchClientCommand, short nMessageSize)');
  const ReadVersion = f('void __stdcall RP1210_ReadVersion(void *DLLMajor, void *DLLMinor, void *APIMajor, void *APIMinor)');
  const ReadDetailedVersion = f('short __stdcall RP1210_ReadDetailedVersion(short nClientID, void *APIInfo, void *DLLInfo, void *FWInfo)');
  const GetErrorMsg = f('short __stdcall RP1210_GetErrorMsg(short errCode, void *fpchMessage)');
  const GetHardwareStatus = f('short __stdcall RP1210_GetHardwareStatus(short nClientID, void *fpchClientInfo, short nInfoSize, short nBlockOnRequest)');

  const api: Rp1210Api = {
    vendorId,
    ClientConnect: (h, d, p, t, r, a) => ClientConnect(h, d, p, t, r, a),
    ClientDisconnect: (c) => ClientDisconnect(c),
    SendMessage: (c, m, s, n, b) => SendMessage(c, m, s, n, b),
    ReadMessage: (c, m, s, b) => ReadMessage(c, m, s, b),
    SendCommand: (cmd, c, d, s) => SendCommand(cmd, c, d, s),
    ReadVersionRaw: (a, b, c, d) => { ReadVersion(a, b, c, d); },
    ReadDetailedVersion: (c, a, d, fw) => ReadDetailedVersion(c, a, d, fw),
    GetErrorMsgRaw: (e, b) => GetErrorMsg(e, b),
    GetHardwareStatus: (c, b, s, k) => GetHardwareStatus(c, b, s, k),
    getErrorMsg(code) {
      const buf = Buffer.alloc(80);
      api.GetErrorMsgRaw(code, buf);
      return cstr(buf);
    },
    readVersion() {
      const b = [Buffer.alloc(17), Buffer.alloc(17), Buffer.alloc(17), Buffer.alloc(17)];
      api.ReadVersionRaw(b[0], b[1], b[2], b[3]);
      return { dllMajor: cstr(b[0]), dllMinor: cstr(b[1]), apiMajor: cstr(b[2]), apiMinor: cstr(b[3]) };
    },
  };
  return api;
}
