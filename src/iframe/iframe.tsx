// src/iframe/iframe.tsx
import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { RedactionModal } from '../components/Modal'; // We will move the UI into a reusable component

type Match = { name: string; value: string; dummyValue: string; };

const IframeApp = () => {
    const [redactionData, setRedactionData] = useState<{ originalText: string, matches: Match[] } | null>(null);

    useEffect(() => {
        // Listen for the data from the content script
        const messageListener = (event: MessageEvent) => {
            // Basic security: only accept messages from the same origin
            if (event.source !== window.parent) return;

            const data = event.data;
            if (data.type === 'dlp-data') {
                setRedactionData({
                    originalText: data.originalText,
                    matches: data.matches
                });
            }
        };

        window.addEventListener('message', messageListener);
        return () => window.removeEventListener('message', messageListener);
    }, []);

    // Function to send the decision back to the content script
    const handleDecision = useCallback((action: string, text?: string) => {
        window.parent.postMessage({ type: 'dlp-decision', action, text }, '*');
    }, []);

    if (!redactionData) {
        return null; // Render nothing until we receive data
    }

    return (
        <RedactionModal
            originalText={redactionData.originalText}
            matches={redactionData.matches}
            onDecision={handleDecision}
        />
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<IframeApp />);