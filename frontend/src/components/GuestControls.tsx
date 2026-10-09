import React from 'react';

interface GuestControlsProps {
    roomId: string;
    setRoomId: (id: string) => void;
    joinRoom: () => void;
}

export const GuestControls: React.FC<GuestControlsProps> = ({
    roomId,
    setRoomId,
    joinRoom
}) => {
    return (
        <div className='guest-container'>
            <input
                className='join-input'
                type="text"
                placeholder='Enter Room ID'
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
            />
            <button className='join-button' onClick={joinRoom}>Join Party (Guest)</button>
        </div>
    );
};