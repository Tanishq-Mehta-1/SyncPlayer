import React, { useEffect } from 'react';

interface SyncPlayerProps {
    audioURL: string | null;
    audioRef: React.RefObject<HTMLAudioElement>;
    broadcastCommand: (type: string, time?: number, title?: string) => void;
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

    return (
        <div className='audio-player' style={{ display: audioURL ? 'flex' : 'none' }}>
            <audio
                loop
                controls
                src={audioURL || undefined}
                ref={audioRef}
                onPlay={(e) => broadcastCommand('PLAY', (e.target as HTMLAudioElement).currentTime)}
                onPause={(e) => broadcastCommand('PAUSE', (e.target as HTMLAudioElement).currentTime)}
                onSeeked={(e) => broadcastCommand('SEEK', (e.target as HTMLAudioElement).currentTime)}
            />
        </div>
    );
};