import React from 'react';

interface DisconnectButtonProps {
    onClick: () => void;
}

const style: React.CSSProperties = {
    marginBottom: '10px',
    background: 'linear-gradient(#ffccd5 0%, #ff8099 48%, #ff4d6d 50%, #ff8099 100%)',
    borderColor: '#cc0022',
    color: '#4d000d',
};

export const DisconnectButton: React.FC<DisconnectButtonProps> = ({ onClick }) => (
    <button onClick={onClick} style={style}>
        ⬅ Disconnect & Go Back
    </button>
);
