import { useEffect, useRef } from 'react';
import { HostControls } from './components/HostControls.js';
import { GuestControls } from './components/GuestControls.js';
import { SyncPlayer } from './components/SyncPlayer.js';
import { DisconnectButton } from './components/DisconnectButton.js';
import { ErrorDialog } from './components/ErrorDialog.js';
import { useWebRTC } from './hooks/useWebRTC.js';
import { useAutoDismiss } from './hooks/useAutoDismiss.js';
import './App_y2k.css';

export default function App() {
    const audioRef = useRef<HTMLAudioElement>(null);
    const {
        roomId,
        setRoomId,
        hasJoined,
        audioURL,
        alertMessage,
        setAlertMessage,
        isHost,
        createRoom,
        joinRoom,
        leaveRoom,
        handleFileSelect,
        sendAudioFile,
        broadcastCommand,
    } = useWebRTC(audioRef);

    // flush the old track and load the new track when the url changes
    // needed for mobile
    useEffect(() => {
        if (audioRef.current && audioURL) {
            audioRef.current.load();
        }
    }, [audioURL]);

    useAutoDismiss(alertMessage, () => setAlertMessage(''));

    return (
        <div className='App-container'>
            <h1>SyncPlayer</h1>

            {(hasJoined || isHost) && <DisconnectButton onClick={leaveRoom} />}

            <ErrorDialog message={alertMessage} />

            {!hasJoined && (
                <HostControls
                    isHost={isHost}
                    roomId={roomId}
                    createRoom={createRoom}
                    onFileSelect={handleFileSelect}
                    sendAudioFile={sendAudioFile}
                />
            )}

            {!isHost && (
                <GuestControls
                    roomId={roomId}
                    setRoomId={setRoomId}
                    joinRoom={joinRoom}
                    hasJoined={hasJoined}
                />
            )}

            <SyncPlayer
                isHost={isHost}
                audioURL={audioURL}
                audioRef={audioRef}
                broadcastCommand={broadcastCommand}
            />
        </div>
    );
}
