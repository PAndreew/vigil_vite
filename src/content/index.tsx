// src/content/index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RedactionModal } from '../components/Modal';

let root: ReactDOM.Root | null = null;
let shadowHost: HTMLDivElement | null = null;

const showRedactionModal = (originalText: string, matches: any[], targetElement: HTMLElement) => {
    if (document.getElementById('dlp-shadow-host')) return;

    shadowHost = document.createElement('div');
    shadowHost.id = 'dlp-shadow-host';
    document.body.appendChild(shadowHost);

    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    const appContainer = document.createElement('div');
    shadowRoot.appendChild(appContainer);

    const handleDecision = (decision: { action: string; text?: string }) => {
        if (decision.action === 'pasteModified' || decision.action === 'pasteOriginal') {
            pasteText(decision.text!, targetElement);
        }
        if (shadowHost) {
            document.body.removeChild(shadowHost);
            shadowHost = null;
        }
    };

    root = ReactDOM.createRoot(appContainer);
    root.render(
        <React.StrictMode>
            <RedactionModal originalText={originalText} matches={matches} onDecision={handleDecision} />
        </React.StrictMode>
    );
};

// --- Paste listener and pasteText function remain unchanged ---
document.addEventListener('paste', (event) => {
    const targetElement = event.target as HTMLElement;
    const pastedText = event.clipboardData?.getData('text/plain');
    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;
    if (!isEditable || !pastedText) return;
    event.preventDefault();
    event.stopPropagation();
    chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: pastedText }, (response) => {
        if (chrome.runtime.lastError || !response || (response.matches && response.matches.length === 0)) {
            pasteText(pastedText, targetElement);
        } else {
            showRedactionModal(pastedText, response.matches, targetElement);
        }
    });
}, true);

function pasteText(text: string, targetElement: any) {
    if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        const start = targetElement.selectionStart;
        const end = targetElement.selectionEnd;
        targetElement.value = targetElement.value.substring(0, start) + text + targetElement.value.substring(end);
        targetElement.selectionStart = targetElement.selectionEnd = start + text.length;
        targetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else if (targetElement.isContentEditable) {
        document.execCommand('insertText', false, text);
    }
}