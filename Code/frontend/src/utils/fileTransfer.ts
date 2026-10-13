import { FILE_CHUNK_SIZE, FILE_MAX_BUFFER } from '../config.js';

/** Streams an ArrayBuffer over a data channel in chunks, respecting backpressure. */
export function sendFileOverChannel(dc: RTCDataChannel | undefined, arrayBuffer: ArrayBuffer): void {
    if (!dc || dc.readyState !== 'open') return;

    let offset = 0;

    const sendNextBatch = () => {
        while (offset < arrayBuffer.byteLength) {
            if (dc.bufferedAmount >= FILE_MAX_BUFFER) break;

            dc.send(arrayBuffer.slice(offset, offset + FILE_CHUNK_SIZE));
            offset += FILE_CHUNK_SIZE;
        }

        if (offset >= arrayBuffer.byteLength) {
            dc.send('EOF');
            console.log('Audio file sent');
        }
    };

    dc.onbufferedamountlow = () => {
        if (offset < arrayBuffer.byteLength) sendNextBatch();
    };

    sendNextBatch();
}
