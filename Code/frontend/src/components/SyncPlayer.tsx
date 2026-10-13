import React, { useEffect } from 'react';

interface SyncPlayerProps {
    audioURL: string | null;
    audioRef: React.RefObject<HTMLAudioElement>;
    broadcastCommand: (type: string, time: number) => void;
}

export const SyncPlayer: React.FC<SyncPlayerProps> = ({
    audioURL,
    audioRef,
    broadcastCommand
}) => {
    useEffect(() => {
        if (audioRef.current && audioURL) {
            audioRef.current.load();
        }
    }, [audioURL, audioRef]);

    if (!audioURL) return null;

    return (
        <div className='audio-player' style={{ display: audioURL ? 'flex' : 'none' }}>
            <audio
                loop
                controls
                src={audioURL || undefined}
                ref={audioRef}
                onPlay={(e) => broadcastCommand("PLAY", e.currentTarget.currentTime)}
                onPause={(e) => broadcastCommand("PAUSE", e.currentTarget.currentTime)}
                onSeeked={(e) => broadcastCommand('SEEK', e.currentTarget.currentTime)}
            />
        </div>
    );
};