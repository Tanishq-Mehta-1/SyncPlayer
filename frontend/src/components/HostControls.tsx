import React from 'react';

interface HostControlsProps {
    isHost: boolean;
    roomId: string;
    createRoom: () => void;
    onFileSelect: (file: File) => void;
    sendAudioFile: () => void;
}

export const HostControls: React.FC<HostControlsProps> = ({
    isHost,
    roomId,
    createRoom,
    onFileSelect,
    sendAudioFile
}) => {
    return (
        <div className='host-container'>
            <button onClick={createRoom}>Create Party (Host)</button>
            {isHost && roomId && <p><strong>ROOM ID: </strong>{roomId}</p>}

            {isHost && (
                <input
                    className="file-picker"
                    type="file"
                    accept='audio/*'
                    onChange={(e) => {
                        if (e.target.files != null) {
                            onFileSelect(e.target.files[0]);
                        }
                    }}
                />
            )}

            <button className='send-audiobtn' onClick={sendAudioFile}>
                Send Audio
            </button>
        </div>
    );
};