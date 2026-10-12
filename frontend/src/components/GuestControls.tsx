import React from 'react';

interface GuestControlsProps {
    roomId: string;
    setRoomId: (id: string) => void;
    joinRoom: () => void;
    hasJoined: boolean;
}

export const GuestControls: React.FC<GuestControlsProps> = ({
    roomId,
    setRoomId,
    joinRoom,
    hasJoined
}) => {
    
    // The new success view for connected guests
    if (hasJoined) {
        return (
            <div className='guest-container' style={{ textAlign: 'center', borderColor: 'var(--accent)' }}>
                <h2 style={{ margin: '0', color: 'var(--accent)' }}>Party Joined!</h2>
                {/* <p style={{ margin: 0 }}>You are locked in to room <strong>{roomId}</strong>.</p> */}
                <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '12px' }}>Waiting for the host to send audio...</p>
            </div>
        );
    }

    // The default join form
    return (
        <div className='guest-container'>
            <input
                className='join-input'
                type="text"
                placeholder='Enter Room ID'
                value={roomId}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && roomId.trim() !== ''){
                        joinRoom();
                    }
                }}
                onChange={(e) => setRoomId(e.target.value)}
            />
            <button className='join-button' onClick={joinRoom}>Join Party (Guest)</button>
        </div>
    );
};