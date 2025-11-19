// State to track if we are currently handling a file or a paste
type InteractionType = 'paste' | 'file';

let activeIframe: HTMLIFrameElement | null = null;
let currentTargetElement: HTMLElement | null = null;
let currentInteractionType: InteractionType = 'paste'; 

// --- Helper: Read File Content ---
// Only attempts to read text/code files to prevent hanging on large binaries
const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // basic check for text types or typical code extensions
        const isText = file.type.startsWith('text/') || 
                       file.type === 'application/json' ||
                       file.type.includes('javascript') ||
                       file.name.match(/\.(txt|md|csv|json|js|ts|py|java|c|cpp|h|html|css|xml|log)$/i);

        if (!isText) {
            resolve(''); // Skip binary files for now
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

// --- Hotkey Listener ---
const handleGlobalKeyDown = (event: KeyboardEvent) => {
    if (!activeIframe) return;

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

// --- Show UI ---
function showRedactionUI(originalText: string, matches: any[], targetElement: HTMLElement, type: InteractionType) {
    if (activeIframe) activeIframe.remove();
    
    currentTargetElement = targetElement;
    currentInteractionType = type; // Track what kind of event triggered this

    activeIframe = document.createElement('iframe');
    activeIframe.src = chrome.runtime.getURL('src/iframe/iframe.html');
    activeIframe.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        border: none; z-index: 2147483647; background: transparent;
    `;
    document.body.appendChild(activeIframe);

    activeIframe.onload = () => {
        activeIframe?.contentWindow?.postMessage({ type: 'dlp-data', originalText, matches }, '*');
        document.addEventListener('keydown', handleGlobalKeyDown);
    };
}

// --- Text Insertion Logic ---
function pasteText(text: string, targetElement: any) {
    if (!targetElement) return;
    
    // If we are handling a file, we usually want to paste into the main chat box, 
    // not the file input itself (which can't accept text).
    // We try to find the nearest text area if the target is a file input.
    let finalTarget = targetElement;
    
    if (targetElement.type === 'file') {
        // Strategy: Look for the main active element or a textarea on the page
        // This is a heuristic; for specific chatbots, you might need specific selectors.
        const active = document.activeElement as HTMLElement;
        if (active && (active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            finalTarget = active;
        } else {
            // Fallback: Query for a common chat input
            finalTarget = document.querySelector('textarea, [contenteditable="true"]');
        }
    }

    if (!finalTarget) return;

    if (finalTarget.tagName === 'INPUT' || finalTarget.tagName === 'TEXTAREA') {
        const start = finalTarget.selectionStart || finalTarget.value.length;
        const end = finalTarget.selectionEnd || finalTarget.value.length;
        finalTarget.value = finalTarget.value.substring(0, start) + text + finalTarget.value.substring(end);
        finalTarget.selectionStart = finalTarget.selectionEnd = start + text.length;
        finalTarget.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else if (finalTarget.isContentEditable) {
        finalTarget.focus();
        document.execCommand('insertText', false, text);
    }
}

// --- Decision Handler ---
window.addEventListener('message', (event) => {
    const data = event.data;
    if (data.type === 'dlp-decision') {
        
        // Logic for File Inputs
        if (currentInteractionType === 'file' && currentTargetElement instanceof HTMLInputElement) {
            if (data.action === 'cancel') {
                // BLOCK: Clear the file selection
                currentTargetElement.value = ''; 
            } else if (data.action === 'pasteOriginal') {
                // ALLOW: Do nothing, let the file stay attached
            } else if (data.action === 'pasteModified') {
                // CONVERT: Clear file, paste redacted text instead
                currentTargetElement.value = '';
                pasteText(data.text, currentTargetElement);
            }
        } 
        // Logic for Paste Events
        else if (currentInteractionType === 'paste') {
            if (data.action !== 'cancel' && currentTargetElement) {
                pasteText(data.text, currentTargetElement);
            }
        }

        if (activeIframe) {
            activeIframe.remove();
            activeIframe = null;
        }
        currentTargetElement = null;
        document.removeEventListener('keydown', handleGlobalKeyDown);
    }
});

// =======================================================================
//  LISTENER 1: FILE UPLOADS
// =======================================================================
document.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    
    // Only care if it is a file input and has files
    if (target && target.type === 'file' && target.files && target.files.length > 0) {
        const file = target.files[0]; // Grab the first file
        
        try {
            const fileContent = await readFileContent(file);
            
            // If file is empty or binary (skipped), ignore
            if (!fileContent) return;

            chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: fileContent }, (response) => {
                if (chrome.runtime.lastError) return;

                if (response && response.matches && response.matches.length > 0) {
                    // Sensitive data found in file!
                    // Note: We cannot prevent the 'change' event propagation easily as it happened.
                    // But we CAN clear the value if the user decides to cancel in our UI.
                    showRedactionUI(fileContent, response.matches, target, 'file');
                }
            });
        } catch (err) {
            console.warn("[DLP] Error reading file:", err);
        }
    }
}, true); // Capture phase

// =======================================================================
//  LISTENER 2: PASTE EVENTS
// =======================================================================
document.addEventListener('paste', (event) => {
    const pastedText = event.clipboardData?.getData('text/plain');
    const targetElement = event.target as HTMLElement;
    const isEditable = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable;

    if (!isEditable || !pastedText) return;

    event.preventDefault();
    event.stopPropagation();

    chrome.runtime.sendMessage({ type: 'analyzeForRedaction', data: pastedText }, (response) => {
        if (chrome.runtime.lastError) {
            pasteText(pastedText, targetElement);
            return;
        }

        if (response && response.matches && response.matches.length > 0) {
            showRedactionUI(pastedText, response.matches, targetElement, 'paste');
        } else {
            pasteText(pastedText, targetElement);
        }
    });
}, true);