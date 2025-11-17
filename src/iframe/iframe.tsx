// src/iframe/iframe.tsx

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
// Import the component and its ref type
import { RedactionModal } from '../components/Modal';
import type { RedactionModalRef } from '../components/Modal';

type Match = { name: string; value: string; dummyValue: string; };

const IframeApp = () => {
    // Create a ref to hold the instance of our modal component
    const modalRef = useRef<RedactionModalRef>(null);
    const [redactionData, setRedactionData] = useState<{ originalText: string, matches: Match[] } | null>(null);

    // This function is still the single point of truth for sending the final decision
    const handleDecision = useCallback((action: string, text?: string) => {
        window.parent.postMessage({ type: 'dlp-decision', action, text }, '*');
    }, []);

    useEffect(() => {
        const messageListener = (event: MessageEvent) => {
            if (event.source !== window.parent) return;
            const data = event.data;
            if (data.type === 'dlp-data') {
                setRedactionData({ originalText: data.originalText, matches: data.matches });
            }
            // --- THE FIX: Use the ref to call functions on the modal component ---
            else if (data.type === 'dlp-hotkey') {
                switch (data.action) {
                    case 'pasteModified':
                        modalRef.current?.triggerPasteModified();
                        break;
                    case 'pasteOriginal':
                        modalRef.current?.triggerPasteOriginal();
                        break;
                    case 'cancel':
                        modalRef.current?.triggerCancel();
                        break;
                }
            }
        };

        window.addEventListener('message', messageListener);
        return () => window.removeEventListener('message', messageListener);
    }, []); // Removed handleDecision from dependencies as it's stable

    if (!redactionData) {
        return null;
    }

    return (
        <RedactionModal
            // Pass the ref to the component
            ref={modalRef}
            originalText={redactionData.originalText}
            matches={redactionData.matches}
            onDecision={handleDecision}
        />
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<IframeApp />);