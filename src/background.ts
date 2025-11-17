// src/background.ts

console.log('[DLP Background] Rule-based Engine starting up.');

type PiiRule = {
    name: string;
    regex: string;
    dummyValue: string;
};

type Finding = {
    name: string;
    value: string;
    dummyValue: string;
};

let piiRules: PiiRule[] = [];

// --- RULE LOADING ---
async function loadRules() {
    try {
        const rulesURL = chrome.runtime.getURL('pii-rules.json');
        const response = await fetch(rulesURL);
        if (!response.ok) throw new Error(`Failed to fetch rules: ${response.statusText}`);
        piiRules = await response.json();
        console.log(`[DLP] Successfully loaded ${piiRules.length} specific PII rules.`);
    } catch (error) {
        console.error('[DLP] CRITICAL: Could not load pii-rules.json.', error);
        piiRules = [];
    }
}
loadRules();

// --- ONE-TIME SETUP on INSTALL ---
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        console.log('[DLP] First-time installation. Setting up default protected sites.');
        const data = await chrome.storage.local.get('protectedDomains');
        if (!data.protectedDomains) {
            const manifest = chrome.runtime.getManifest();
            const defaultSites = new Set<string>();
            const resources = manifest.web_accessible_resources || [];

            for (const resource of resources) {
                // =================================================================
                // BUG FIX: Add a type guard to satisfy TypeScript.
                // We must check that 'resource' is an object and has the 'matches'
                // property before we attempt to access it. This makes the code
                // robust against different manifest configurations.
                // =================================================================
                if (typeof resource === 'object' && resource.matches) {
                    for (const match of resource.matches) {
                        try {
                            const cleanUrl = match.replace('/*', '');
                            const hostname = new URL(cleanUrl).hostname;
                            defaultSites.add(hostname);
                        } catch (e) {
                            console.warn(`[DLP] Could not parse manifest match pattern: ${match}`);
                        }
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
                console.error('[DLP Background] CRITICAL ERROR in handleAnalysis:', error);
                sendResponse({ matches: [] });
            });
        return true;
    }
});

// --- CORE LOGIC (No changes needed here) ---
async function handleAnalysis(message: any, sender: chrome.runtime.MessageSender) {
    if (!message.data || typeof message.data !== 'string' || message.data.length > 100000) {
        return { matches: [] };
    }
    const settings = await chrome.storage.local.get(['dlpEnabled', 'protectedDomains']);
    if (settings.dlpEnabled === false) return { matches: [] };
    const protectedDomains = settings.protectedDomains || [];
    if (sender.tab?.url) {
        try {
            const url = new URL(sender.tab.url);
            if (!protectedDomains.includes(url.hostname)) return { matches: [] };
        } catch (e) { return { matches: [] }; }
    } else { return { matches: [] }; }
    const findings = findSensitiveData(message.data);
    return { matches: findings };
}

// --- THE NEW & IMPROVED DETECTION ENGINE ---
function findSensitiveData(text: string): Finding[] {
    const findings: Finding[] = [];
    const matchedValues = new Set<string>();

    // STAGE 1: Specific Rule Matching (for emails, phone numbers, etc.)
    for (const rule of piiRules) {
        const regex = new RegExp(rule.regex, 'gi');
        const matches = text.match(regex);
        if (matches) {
            for (const match of matches) {
                if (!matchedValues.has(match)) {
                    findings.push({ name: rule.name, value: match, dummyValue: rule.dummyValue });
                    matchedValues.add(match);
                }
            }
        }
    }

    // STAGE 2: Improved Fallback Rule
    const FALLBACK_CONFIG = { minLength: 8 };
    const words = text.split(/[\s\n\r\t,;()\[\]{}'"]+/);

    for (const word of words) {
        if (word.length < FALLBACK_CONFIG.minLength || matchedValues.has(word)) {
            continue;
        }

        const hasNumber = /[0-9]/.test(word);
        const hasLetter = /[a-zA-Z]/.test(word);
        const hasSpecialChar = /[^a-zA-Z0-9]/.test(word); // Checks for any non-alphanumeric char

        // =================================================================
        // BUG FIX 2: Restore the original "crude" rule's logic.
        // It now checks for (letters + numbers) OR (special chars + numbers).
        // This will correctly identify API keys, passwords, AND order numbers like #8401-2295.
        // =================================================================
        if ((hasLetter && hasNumber) || (hasSpecialChar && hasNumber)) {
            findings.push({
                name: 'Potential Sensitive ID / Code', // More generic and accurate name
                value: word,
                dummyValue: '[REDACTED]'
            });
            matchedValues.add(word);
        }
    }
    return findings;
}