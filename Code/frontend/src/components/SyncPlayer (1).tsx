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
    // Reload the element whenever a new audio source arrives
    useEffect(() => {
        if (audioRef.current && audioURL) {
            audioRef.current.load();
        }
    }, [audioURL, audioRef]);

    if (!audioURL) return null;

    return (
        <div className='audio-player' style={{ display: 'flex' }}>
            <audio
                loop
                controls
                src={audioURL}
                ref={audioRef}
                onPlay={(e) => broadcastCommand("PLAY", e.currentTarget.currentTime)}
                onPause={(e) => broadcastCommand("PAUSE", e.currentTarget.currentTime)}
                onSeeked={(e) => broadcastCommand('SEEK', e.currentTarget.currentTime)}
            />
        </div>
    );
};
