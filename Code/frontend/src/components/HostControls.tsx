import React, { useState } from 'react';

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

    const [copied, setCopied] = useState(false);

    const copyRoomId = () => {

        // Try modern clipboard API first (localhost and production HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
           
            navigator.clipboard.writeText(roomId).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => console.error("Modern copy failed", err));
        } else {

            //Legacy fallback for HTTP network testing
            const textArea = document.createElement("textarea");
            textArea.value = roomId;

            // Hide the text area so it doesn't break layout
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Fallback copy failed", err);
            }

            document.body.removeChild(textArea);
        }
    };

    return (
        <div className='host-container'>
            {!isHost && <button onClick={createRoom}>Create Party (Host)</button>}

            {isHost && roomId && (
                <p
                    onClick={copyRoomId}
                    style={{ cursor: 'pointer', margin: 0, padding: '12px', background: 'var(--code-bg)', borderRadius: '8px', textAlign: 'center' }}
                    title="Copy to clipboard"
                >
                    <strong>ROOM ID: </strong> <code>{roomId}</code>
                    <span style={{ marginLeft: '10px', fontSize: '14px', color: 'var(--accent)' }}>
                        {copied ? 'Copied!' : 'Copy'}
                    </span>
                </p>
            )}

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

            {isHost && (
                <button className='send-audiobtn' onClick={sendAudioFile}>
                    Send Audio
                </button>
            )}
        </div>
    );
};