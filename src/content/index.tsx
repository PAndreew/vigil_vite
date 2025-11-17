// src/content/index.tsx

let activeIframe: HTMLIFrameElement | null = null;
let currentTargetElement: HTMLElement | null = null;

// This function creates and shows the UI. (No changes here)
function showRedactionUI(originalText: string, matches: any[], targetElement: HTMLElement) {
    if (activeIframe) activeIframe.remove();
    currentTargetElement = targetElement;

    activeIframe = document.createElement('iframe');
    activeIframe.src = chrome.runtime.getURL('src/iframe/iframe.html');
    activeIframe.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
        z-index: 2147483647;
        background: transparent;
    `;
    document.body.appendChild(activeIframe);

    activeIframe.onload = () => {
        activeIframe?.contentWindow?.postMessage({
            type: 'dlp-data',
            originalText,
            matches
        }, '*');
    };
}

// This function manually inserts text into an input/textarea. (No changes here)
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


// Listen for the decision coming back from the iframe. (No changes here)
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
    }
});


// =======================================================================
// THE FIX: The Paste Listener Logic is Completely Rewritten
// =======================================================================
document.addEventListener('paste', (event) => {
    const pastedText = event.clipboardData?.getData('text/plain');
    const targetElement = event.target as HTMLElement;
    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

    if (!isEditable || !pastedText) {
        return; // Do nothing if it's not a place we can paste text.
    }

    // --- STEP 1: STOP THE BROWSER'S DEFAULT PASTE ACTION IMMEDIATELY ---
    // This is the most critical change. We take control of the event right away.
    event.preventDefault();
    event.stopPropagation();

    // --- STEP 2: ANALYZE THE TEXT ASYNCHRONOUSLY ---
    chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: pastedText }, (response) => {
        if (chrome.runtime.lastError) {
            // If the background script fails for any reason, paste the original text.
            console.error("DLP Background Script Error:", chrome.runtime.lastError.message);
            pasteText(pastedText, targetElement);
            return;
        }

        // --- STEP 3: DECIDE WHAT TO DO WITH THE RESULT ---
        if (response && response.matches && response.matches.length > 0) {
            // A) If sensitive data is found, show our UI.
            showRedactionUI(pastedText, response.matches, targetElement);
        } else {
            // B) If the text is clean, we are now responsible for pasting it ourselves.
            pasteText(pastedText, targetElement);
        }
    });
}, true); // Use capture phase to run before the website's own scripts.