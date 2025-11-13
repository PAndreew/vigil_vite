import React from 'react';
import ReactDOM from 'react-dom/client';
import { RedactionModal } from '../components/Modal';
// import './index.css';

let root: ReactDOM.Root | null = null;
let modalContainer: HTMLDivElement | null = null;

const showRedactionModal = (originalText: string, matches: any[], targetElement: HTMLElement) => {
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'dlp-modal-container';
        document.body.appendChild(modalContainer);
    }

    if (!root) {
        root = ReactDOM.createRoot(modalContainer);
    }

    const handleDecision = (decision: { action: string; text?: string }) => {
        if (decision.action === 'pasteModified' || decision.action === 'pasteOriginal') {
            pasteText(decision.text!, targetElement);
        }
        root?.unmount();
        root = null;
        if (modalContainer) {
            document.body.removeChild(modalContainer);
            modalContainer = null;
        }
    };

    root.render(
        <React.StrictMode>
            <RedactionModal originalText={originalText} matches={matches} onDecision={handleDecision} />
        </React.StrictMode>
    );
};

document.addEventListener('paste', (event) => {
    const targetElement = event.target as HTMLElement;
    const pastedText = event.clipboardData?.getData('text/plain');

    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

    if (!isEditable || !pastedText) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: pastedText }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('DLP Background Script Error:', chrome.runtime.lastError.message);
            pasteText(pastedText, targetElement);
            return;
        }

        if (response && response.matches && response.matches.length > 0) {
            showRedactionModal(pastedText, response.matches, targetElement);
        } else {
            pasteText(pastedText, targetElement);
        }
    });
}, true);

function pasteText(text: string, targetElement: any) {
    if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
        const start = targetElement.selectionStart;
        const end = targetElement.selectionEnd;
        const existingValue = targetElement.value;
        targetElement.value = existingValue.substring(0, start) + text + existingValue.substring(end);
        targetElement.selectionStart = targetElement.selectionEnd = start + text.length;
        targetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else if (targetElement.isContentEditable) {
        document.execCommand('insertText', false, text);
    }
}