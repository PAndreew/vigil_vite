// src/content/index.tsx

let activeIframe: HTMLIFrameElement | null = null;
let currentTargetElement: HTMLElement | null = null;

// This is the hotkey listener. It is only active when the iframe is visible.
const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (!activeIframe) return; // Do nothing if the modal isn't open

    if (event.altKey) {
        if (event.key.toLowerCase() === 'r') {
            event.preventDefault();
            activeIframe.contentWindow?.postMessage({ type: 'dlp-hotkey', action: 'pasteModified' }, '*');
        } else if (event.key.toLowerCase() === 'o') {
            event.preventDefault();
            activeIframe.contentWindow?.postMessage({ type: 'dlp-hotkey', action: 'pasteOriginal' }, '*');
        }
    } else if (event.key === 'Escape') {
        event.preventDefault();
        activeIframe.contentWindow?.postMessage({ type: 'dlp-hotkey', action: 'cancel' }, '*');
    }
};

// Creates the iframe and activates the hotkey listener
function showRedactionUI(originalText: string, matches: any[], targetElement: HTMLElement) {
    if (activeIframe) activeIframe.remove();
    currentTargetElement = targetElement;

    activeIframe = document.createElement('iframe');
    activeIframe.src = chrome.runtime.getURL('src/iframe/iframe.html');
    activeIframe.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        border: none; z-index: 2147483647; background: transparent;
    `;
    document.body.appendChild(activeIframe);

    activeIframe.onload = () => {
        activeIframe?.contentWindow?.postMessage({ type: 'dlp-data', originalText, matches }, '*');
        // Activate listener now that UI is visible
        document.addEventListener('keydown', handleGlobalKeyDown);
    };
}

// Manually inserts text into the target element
function pasteText(text: string, targetElement: any) {
    if (!targetElement) return;
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

// Listens for the decision from the iframe and deactivates the hotkey listener
window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.type === 'dlp-decision') {
        if (data.action !== 'cancel' && currentTargetElement) {
            pasteText(data.text, currentTargetElement);
        }
        if (activeIframe) {
            activeIframe.remove();
            activeIframe = null;
        }
        currentTargetElement = null;
        // Deactivate listener now that UI is gone
        document.removeEventListener('keydown', handleGlobalKeyDown);
    }
});

// =======================================================================
// THE CORRECTED PASTE LISTENER
// =======================================================================
document.addEventListener('paste', (event) => {
    const pastedText = event.clipboardData?.getData('text/plain');
    const targetElement = event.target as HTMLElement;
    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

    if (!isEditable || !pastedText) {
        return;
    }

    // STEP 1: Always stop the browser's default paste action.
    event.preventDefault();
    event.stopPropagation();

    // STEP 2: Analyze the text.
    chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: pastedText }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("DLP Background Script Error:", chrome.runtime.lastError.message);
            pasteText(pastedText, targetElement); // Fallback on error
            return;
        }

        // STEP 3: Decide what to do.
        if (response && response.matches && response.matches.length > 0) {
            // A) Sensitive data found: Show our UI.
            showRedactionUI(pastedText, response.matches, targetElement);
        } else {
            // B) THE MISSING PIECE: Text is clean, so we manually paste it.
            pasteText(pastedText, targetElement);
        }
    });
}, true); // Use capture phase.