import React from 'react';

interface ErrorDialogProps {
    message: string;
    title?: string;
}

export const ErrorDialog: React.FC<ErrorDialogProps> = ({
    message,
    title = 'Connection Error'
}) => {
    if (!message) return null;

    return (
        <div className="win95-overlay">
            <div className="win95-dialog">
                <div className="win95-titlebar">
                    <span>{title}</span>
                    <div className="win95-close">X</div>
                </div>
                <div className="win95-content">
                    <div className="win95-icon">×</div>
                    <div>{message}</div>
                </div>
            </div>
        </div>
    );
};
