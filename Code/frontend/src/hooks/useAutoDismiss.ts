import { useEffect } from 'react';

/**
 * Clears `message` after `delay` ms, or as soon as the user
 * presses/touches anywhere on the page.
 */
export function useAutoDismiss(
    message: string,
    clear: () => void,
    delay = 2000
) {
    useEffect(() => {
        if (!message) return;

        const timer = setTimeout(clear, delay);
        const handleInteract = () => clear();

        document.addEventListener('mousedown', handleInteract, true);
        document.addEventListener('touchstart', handleInteract, true);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleInteract, true);
            document.removeEventListener('touchstart', handleInteract, true);
        };
    }, [message, clear, delay]);
}
