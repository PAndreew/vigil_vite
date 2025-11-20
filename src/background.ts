console.log('[DLP Background] Rule-based Engine starting up.');

type PiiRule = { name: string; regex: string; dummyValue: string; };
type Finding = { name: string; value: string; dummyValue: string; };

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
        const hasSpecialChar = /[^a-zA-Z0-9]/.test(word);

        // =================================================================
        // "CRUDE RULE" logic.
        // It checks for (letters + numbers) OR (special chars + numbers).
        // This will correctly identify API keys, passwords, etc.
        // =================================================================
        if ((hasLetter && hasNumber) || (hasSpecialChar && hasNumber)) {
            findings.push({
                name: 'Other Potential Sensitive Data',
                value: word,
                dummyValue: '[REDACTED]'
            });
            matchedValues.add(word);
        }
    }
    return findings;
}