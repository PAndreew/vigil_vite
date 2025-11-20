console.log('[DLP Background] Rule-based Engine starting up.');

type PiiRule = {
    name: string;
    regex: string;
};

type Finding = {
    name: string;
    value: string;
    dummyValue: string;
    index: number;
    length: number;
};

let piiRules: PiiRule[] = [];
// 1. Create a promise variable to track loading state
let rulesLoadedPromise: Promise<void> | null = null;

// --- RULE LOADING ---
async function loadRules() {
    try {
        const rulesURL = chrome.runtime.getURL('pii-rules.json');
        const response = await fetch(rulesURL);
        if (!response.ok) throw new Error(`Failed to fetch rules`);
        piiRules = await response.json();
        console.log(`[DLP] Loaded ${piiRules.length} rules.`);
    } catch (error) {
        console.error('[DLP] Error loading rules:', error);
        piiRules = [];
    }
}

// 2. Initialize the promise immediately
rulesLoadedPromise = loadRules();


// --- HELPER: Generate Redaction Dynamically ---
function generateStructuralRedaction(text: string): string {
    return text.split('').map(char => {
        if (/[0-9]/.test(char)) return '0';
        if (/[a-zA-Z]/.test(char)) return 'A'; // Using 'A' as requested
        return char; // Keep -, ., @, spaces, etc.
    }).join('');
}

// --- HELPER: Check Protected Domain ---
function isDomainProtected(currentUrl: string, protectedList: string[]): boolean {
    if (!currentUrl) return false; // Safety check
    try {
        const currentHost = new URL(currentUrl).hostname.toLowerCase();
        return protectedList.some(domain => {
            let target = domain.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
            return currentHost === target || currentHost.endsWith('.' + target);
        });
    } catch (e) { return false; }
}

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'analyzeForRedaction') {
        // 3. IMPORTANT: return true to indicate we will respond asynchronously
        handleAnalysis(message, sender).then(sendResponse);
        return true; 
    }
});

// --- CORE LOGIC ---
async function handleAnalysis(message: any, sender: chrome.runtime.MessageSender) {
    // 4. Await the rules before doing anything else
    if (rulesLoadedPromise) {
        await rulesLoadedPromise;
    }

    if (!message.data || typeof message.data !== 'string' || message.data.length > 1000000) {
        return { matches: [] };
    }

    const settings = await chrome.storage.local.get(['dlpEnabled', 'protectedDomains']);
    if (settings.dlpEnabled === false) return { matches: [] };

    const protectedDomains = settings.protectedDomains || [];

    if (sender.tab?.url) {
        if (!isDomainProtected(sender.tab.url, protectedDomains)) {
            return { matches: [] };
        }
    } else {
        // If sender.tab.url is undefined (permissions issue), we fail safe.
        console.warn("[DLP] Could not determine tab URL. Check host_permissions.");
        return { matches: [] };
    }

    const findings = findSensitiveData(message.data);
    return { matches: findings };
}

function findSensitiveData(text: string): Finding[] {
    const findings: Finding[] = [];
    
    // 1. Create a "Mask" to track which characters are already claimed by a rule.
    //    false = free, true = taken
    const mask = new Array(text.length).fill(false);

    // Helper to check if a range is free
    const isRangeFree = (start: number, end: number) => {
        for (let i = start; i < end; i++) {
            if (mask[i]) return false;
        }
        return true;
    };

    // Helper to mark a range as taken
    const markRange = (start: number, end: number) => {
        for (let i = start; i < end; i++) {
            mask[i] = true;
        }
    };

    // 2. Run Specific Rules (Higher Priority)
    //    We assume piiRules are loaded. If not, this loop is skipped.
    for (const rule of piiRules) {
        try {
            const regex = new RegExp(rule.regex, 'gi');
            let match;
            
            // valid regex execution loop
            while ((match = regex.exec(text)) !== null) {
                const start = match.index;
                const value = match[0];
                const end = start + value.length;

                // CHECK FOR OVERLAP
                if (isRangeFree(start, end)) {
                    markRange(start, end); // Claim these characters
                    findings.push({
                        name: rule.name,
                        value: value,
                        // GENERATE DYNAMIC REDACTION
                        dummyValue: generateStructuralRedaction(value),
                        index: start,
                        length: value.length
                    });
                }
            }
        } catch (e) {
            console.error(`Error executing rule ${rule.name}`, e);
        }
    }

    // 3. Run Fallback Logic (Lowest Priority)
    //    Only checks characters that haven't been claimed by specific rules.
    const FALLBACK_CONFIG = { minLength: 8 };
    
    // We manually tokenize by splitting on whitespace/symbols to find "potential secrets"
    // But we must map these tokens back to their original indices to check the mask.
    const tokenRegex = /[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g;
    let tokenMatch;

    while ((tokenMatch = tokenRegex.exec(text)) !== null) {
        const word = tokenMatch[0];
        const start = tokenMatch.index;
        const end = start + word.length;

        // Skip if too short or if ANY part of this word is already redacted
        // (e.g. if a word is "user:password", and "password" was caught by a rule, ignore the whole token to avoid partial messy redacts)
        if (word.length < FALLBACK_CONFIG.minLength || !isRangeFree(start, end)) {
            continue;
        }

        const hasNumber = /[0-9]/.test(word);
        const hasLetter = /[a-zA-Z]/.test(word);
        const hasSpecialChar = /[^a-zA-Z0-9]/.test(word);

        if ((hasLetter && hasNumber) || (hasSpecialChar && hasNumber)) {
            markRange(start, end);
            findings.push({
                name: 'Potential Sensitive ID',
                value: word,
                dummyValue: generateStructuralRedaction(word),
                index: start,
                length: word.length
            });
        }
    }

    return findings;
}