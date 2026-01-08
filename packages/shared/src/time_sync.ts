export type TimeSyncMessage =
  | TimeSyncRequest
  | TimeSyncResponse;

export interface TimeSyncRequest {
  type: 'request';
  requester_start_time: number;
}

export interface TimeSyncResponse {
  type: 'response';
  requester_start_time: number;
  responder_time: number;
}

export function create_TimeSyncRequest(): TimeSyncRequest {
  return { type: 'request', requester_start_time: performance.now() };
}

export function process_TimeSyncResponse(requester_start_time: number): number {
  const requester_end_time = performance.now();
  const RTT = requester_end_time - requester_start_time;
  const latency = RTT / 2;
  return latency;
}