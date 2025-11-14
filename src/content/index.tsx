import React from 'react';
import ReactDOM from 'react-dom/client';
import { RedactionModal } from '../components/Modal';

// This Vite feature imports the CSS file's content as a string, which is perfect for injection.
import modalStyles from '../index.css?inline';

let root: ReactDOM.Root | null = null;
let shadowHost: HTMLDivElement | null = null;

const showRedactionModal = (originalText: string, matches: any[], targetElement: HTMLElement) => {
    // Prevent multiple modals from opening
    if (document.getElementById('dlp-shadow-host')) return;

    // 1. Create the host element. It has NO styles. It's just an invisible anchor in the page.
    shadowHost = document.createElement('div');
    shadowHost.id = 'dlp-shadow-host';
    document.body.appendChild(shadowHost);

    // 2. Attach the shadow DOM to the invisible anchor
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // 3. Create a simple, unstyled container inside the shadow DOM for React to mount to
    const appContainer = document.createElement('div');
    shadowRoot.appendChild(appContainer);

    // 4. Inject the Tailwind CSS styles directly into the shadow DOM.
    // This protects our modal's styling from the host page.
    const styleElement = document.createElement('style');
    styleElement.textContent = modalStyles;
    shadowRoot.appendChild(styleElement);

    // 5. Define the cleanup function
    const handleDecision = (decision: { action: string; text?: string }) => {
        if (decision.action === 'pasteModified' || decision.action === 'pasteOriginal') {
            pasteText(decision.text!, targetElement);
        }
        // When the modal is done, remove the invisible anchor from the page
        if (shadowHost) {
            document.body.removeChild(shadowHost);
            shadowHost = null;
        }
    };

    // 6. Render our React component.
    // The <RedactionModal> itself will create its own overlay and content using `position: fixed`,
    // which positions it relative to the browser window, NOT the invisible anchor.
    root = ReactDOM.createRoot(appContainer);
    root.render(
        <React.StrictMode>
            <RedactionModal originalText={originalText} matches={matches} onDecision={handleDecision} />
        </React.StrictMode>
    );
};

// --- NO CHANGES NEEDED BELOW THIS LINE ---

document.addEventListener('paste', (event) => {
    const targetElement = event.target as HTMLElement;
    const pastedText = event.clipboardData?.getData('text/plain');
    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

    if (!isEditable || !pastedText) return;

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
        targetElement.value = targetElement.value.substring(0, start) + text + targetElement.value.substring(end);
        targetElement.selectionStart = targetElement.selectionEnd = start + text.length;
        targetElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else if (targetElement.isContentEditable) {
        document.execCommand('insertText', false, text);
    }
}