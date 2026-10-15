export const SIGNALING_URL = 'http://10.29.198.114:3000';
// export const SIGNALING_URL = 'http://localhost:3000';

//dont use, ethernet ip, phone only works for cellular hotspot
// export const SIGNALING_URL = 'http://172.29.182.224:3000'; 

export const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

export const FILE_CHUNK_SIZE = 16384; // 16KB
export const FILE_MAX_BUFFER = 65535; // 64KB

export const SYNC_BROADCAST_INTERVAL_MS = 2000;
export const PING_INTERVAL_MS = 1000;
