export interface PlaybackCommand {
    type: string; // PLAY | PAUSE | SEEK | SYNC
    time: number;
    timestamp: number;
    isPlaying?: boolean;
}

/**
 * Applies a command received from the host to the guest's audio element,
 * compensating for clock offset and network delay.
 */
export function applyPlaybackCommand(
    audio: HTMLAudioElement,
    command: PlaybackCommand,
    clockOffset: number
): void {
    if (audio.readyState === 0) return;

    const syncDateNow = Date.now() + clockOffset;
    const delay = Math.max(0, (syncDateNow - command.timestamp) / 1000);
    const targetTime = command.time + delay;

    if (command.type === 'SYNC') {
        if (command.isPlaying && audio.paused) {
            audio.currentTime = targetTime;
            audio.play().catch(e => console.error('Autoplay blocked by browser:', e));
        } else if (!command.isPlaying && !audio.paused) {
            audio.pause();
            audio.currentTime = targetTime;
        } else if (command.isPlaying) {
            const drift = targetTime - audio.currentTime;

            // widen the gaps so that mobile doesnt stutter
            if (Math.abs(drift) > 2.0) {
                audio.currentTime = targetTime;
                audio.playbackRate = 1.0;
            } else if (drift > 0.1) {
                audio.playbackRate = 1.02;
            } else if (drift < -0.1) {
                audio.playbackRate = 0.98;
            } else if (Math.abs(drift) < 0.04) {
                // only return to normal if we are locked in
                if (audio.playbackRate !== 1.0) audio.playbackRate = 1.0;
            }
        }
        return;
    }

    // Explicit commands (PLAY, PAUSE, SEEK)
    audio.playbackRate = 1.0; // reset speed safety
    audio.currentTime = targetTime;

    if (command.type === 'PAUSE') {
        audio.pause();
    } else if (command.type === 'PLAY') {
        audio.play();
    }
}
