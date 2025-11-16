// src/background.ts

console.log('[DLP Background] Protection Engine starting up.');

const DETECTION_CONFIG = {
    minLength: 8,
    requiresNumber: true,
    requiresLetter: true,
};

// --- ONE-TIME SETUP on INSTALL ---
// This runs when the extension is first installed or updated.
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        console.log('[DLP] First-time installation. Setting up default protected sites.');

        // Check if a list already exists. If not, create one from the manifest.
        const data = await chrome.storage.local.get('protectedDomains');
        if (!data.protectedDomains) {
            const manifest = chrome.runtime.getManifest();
            const defaultSites = new Set<string>();

            // Extract hostnames from the manifest's `web_accessible_resources` matches
            const resources = manifest.web_accessible_resources || [];
            for (const resource of resources) {
                for (const match of resource.matches) {
                    try {
                        // Create a URL object to easily extract the hostname
                        const hostname = new URL(match).hostname;
                        defaultSites.add(hostname);
                    } catch (e) {
                        // Ignore invalid match patterns
                    }
                }
            }
            
            const defaultDomainList = Array.from(defaultSites);
            await chrome.storage.local.set({ protectedDomains: defaultDomainList });
            console.log('[DLP] Default protected sites initialized:', defaultDomainList);
        }
    }
});

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'analyzeForRedaction') {
        handleAnalysis(message, sender)
            .then(sendResponse)
            .catch((error) => {
                console.error('[DLP Background] CRITICAL ERROR:', error);
                sendResponse({ matches: [] });
            });
        return true;
    }
});

// --- CORE LOGIC (REVERSED) ---
async function handleAnalysis(message: any, sender: chrome.runtime.MessageSender) {
    if (!message.data || typeof message.data !== 'string' || message.data.length > 100000) {
        return { matches: [] };
    }

    const settings = await chrome.storage.local.get(['dlpEnabled', 'protectedDomains']);

    // Exit if protection is globally disabled
    if (settings.dlpEnabled === false) {
        return { matches: [] };
    }

    // Get the list of sites where protection is active
    const protectedDomains = settings.protectedDomains || [];

    if (sender.tab?.url) {
        try {
            const url = new URL(sender.tab.url);

            // *** THE KEY LOGIC CHANGE ***
            // If the current site's hostname is NOT in our list, do nothing.
            if (!protectedDomains.includes(url.hostname)) {
                // This console log is helpful for debugging
                // console.log(`[DLP] Skipping analysis on non-protected site: ${url.hostname}`);
                return { matches: [] };
            }
            // If we reach here, the site IS on the list, so we proceed.
            console.log(`[DLP] Analyzing paste on protected site: ${url.hostname}`);

        } catch (e) {
            return { matches: [] }; // Invalid URL, do nothing
        }
    } else {
        return { matches: [] }; // No sender URL, do nothing
    }

    const findings = findGenericSensitiveData(message.data);
    return { matches: findings };
}


// --- DETECTION ENGINE (No changes needed below this line) ---
function sanitizeValue(value: string): string {
    return value
        .replace(/[a-zA-Z]/g, 'A')
        .replace(/[0-9]/g, '0');
}

function findGenericSensitiveData(text: string) {
    const findings: { name: string; value: string; dummyValue: string }[] = [];
    const uniqueMatches = new Set<string>();
    const words = text.split(/[\s\n\r\t,;()\[\]{}'"]+/);
    for (const word of words) {
        if (word.length < DETECTION_CONFIG.minLength) continue;
        const hasNumber = /[0-9]/.test(word);
        const hasLetter = /[a-zA-Z]/.test(word);
        if (hasNumber && hasLetter) {
            if (!uniqueMatches.has(word)) {
                findings.push({
                    name: 'Potential Sensitive Data',
                    value: word,
                    dummyValue: sanitizeValue(word)
                });
                uniqueMatches.add(word);
            }
        }
    }
    return findings;
}