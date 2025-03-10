// Select DOM elements
const initialChoices = document.getElementById('initial-choices');
const personalBtn = document.getElementById('personal-btn');
const aiBtn = document.getElementById('ai-btn');
const gamingBtn = document.getElementById('gaming-btn');
const personalOptions = document.getElementById('personal-options');
const getConfigBtn = document.querySelector('.get-btn');
const downloadBtn = document.querySelector('.download-btn');
const wireGuardConfig = document.querySelector('.wire-guard-config');
const v2rayConfig = document.querySelector('.v2ray-config');
const peerCountInput = document.getElementById('peer-count');
const ipDistributionDiv = document.getElementById('ip-distribution');
const ipv4CountInput = document.getElementById('ipv4-count');
const ipv6CountInput = document.getElementById('ipv6-count');
const dnsModal = document.getElementById('dns-modal');
const gamingDns = document.getElementById('gaming-dns');
const aiDns = document.getElementById('ai-dns');
const confirmDnsBtn = document.getElementById('confirm-dns-btn');

let ipv4List = [];
let ipv6List = [];
let selectedPurpose = null;
let selectedDNS = null;

// Load IPv4 and IPv6 lists from JSON files
const loadIPLists = async () => {
    try {
        const [ipv4Response, ipv6Response] = await Promise.all([
            fetch('js/ipv4.json'),
            fetch('js/ipv6.json')
        ]);
        ipv4List = await ipv4Response.json();
        ipv6List = await ipv6Response.json();
    } catch (error) {
        console.error('Error loading IP lists:', error);
    }
};

// Initial choice handlers
personalBtn.addEventListener('click', () => {
    selectedPurpose = 'personal';
    initialChoices.classList.add('hidden');
    personalOptions.classList.remove('hidden');
});

aiBtn.addEventListener('click', () => {
    selectedPurpose = 'ai';
    initialChoices.classList.add('hidden');
    dnsModal.classList.remove('hidden');
    aiDns.classList.remove('hidden');
});

gamingBtn.addEventListener('click', () => {
    selectedPurpose = 'gaming';
    initialChoices.classList.add('hidden');
    dnsModal.classList.remove('hidden');
    gamingDns.classList.remove('hidden');
});

// DNS selection handler
document.querySelectorAll('input[name="dns"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        selectedDNS = e.target.value;
        confirmDnsBtn.disabled = false;
    });
});

// Confirm DNS button handler
confirmDnsBtn.addEventListener('click', () => {
    dnsModal.classList.add('hidden');
    generateDNSConfig();
});

// Personal config generation
getConfigBtn.addEventListener('click', () => {
    getConfigBtn.textContent = 'Generating...';
    getConfigBtn.disabled = true;
    generatePersonalConfig();
});

// Generate personal config
async function generatePersonalConfig() {
    try {
        showSpinner();
        await loadIPLists();
        const { publicKey, privateKey } = await fetchKeys();
        const installId = generateRandomString(22);
        const fcmToken = `${installId}:APA91b${generateRandomString(134)}`;
        const accountData = await fetchAccount(publicKey, installId, fcmToken);
        if (accountData) generateConfig(accountData, privateKey);
    } catch (error) {
        console.error('Error processing configuration:', error);
        showPopup('Failed to generate config. Please try again.', 'error');
    } finally {
        hideSpinner();
        getConfigBtn.disabled = false;
        getConfigBtn.textContent = 'Generate Config';
        setTimeout(() => {
            if (wireGuardConfig.firstChild) {
                wireGuardConfig.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }
}

// Generate DNS-based config (AI or Gaming)
async function generateDNSConfig() {
    try {
        showSpinner();
        await loadIPLists();
        const { publicKey, privateKey } = await fetchKeys();
        const installId = generateRandomString(22);
        const fcmToken = `${installId}:APA91b${generateRandomString(134)}`;
        const accountData = await fetchAccount(publicKey, installId, fcmToken);
        if (accountData) generateDNSWireGuardConfig(accountData, privateKey);
    } catch (error) {
        console.error('Error processing configuration:', error);
        showPopup('Failed to generate config. Please try again.', 'error');
    } finally {
        hideSpinner();
        setTimeout(() => {
            if (wireGuardConfig.firstChild) {
                wireGuardConfig.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }
}

// Fetch keys
const fetchKeys = async () => {
    try {
        const response = await fetch('https://www.iranguard.workers.dev/keys');
        if (!response.ok) throw new Error(`Failed to fetch keys: ${response.status}`);
        const data = await response.text();
        return {
            publicKey: extractKey(data, 'PublicKey'),
            privateKey: extractKey(data, 'PrivateKey'),
        };
    } catch (error) {
        console.error('Error fetching keys:', error);
        throw error;
    }
};

// Extract key
const extractKey = (data, keyName) =>
    data.match(new RegExp(`${keyName}:\\s(.+)`))?.[1].trim() || null;

// Fetch account
const fetchAccount = async (publicKey, installId, fcmToken) => {
    const apiUrl = 'https://www.iranguard.workers.dev/wg';
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'okhttp/3.12.1',
                'CF-Client-Version': 'a-6.10-2158',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                key: publicKey,
                install_id: installId,
                fcm_token: fcmToken,
                tos: new Date().toISOString(),
                model: 'PC',
                serial_number: installId,
                locale: 'de_DE',
            }),
        });
        if (!response.ok) throw new Error(`Failed to fetch account: ${response.status}`);
        return response.json();
    } catch (error) {
        console.error('Error fetching account:', error);
        throw error;
    }
};

// Generate personal config
const generateConfig = (data, privateKey) => {
    const peerCount = parseInt(peerCountInput.value);
    const ipv4Count = parseInt(ipv4CountInput.value) || 0;
    const ipv6Count = parseInt(ipv6CountInput.value) || 0;

    if (peerCount > 1 && (ipv4Count + ipv6Count !== peerCount)) {
        showPopup('The sum of IPv4 and IPv6 peers must equal the total number of peers.', 'error');
        return;
    }

    const reserved = generateReserved(data.config.client_id);
    const endpoint = getRandomEndpoint();
    const wireGuardText = generateWireGuardConfig(data, privateKey, endpoint, peerCount, ipv4Count, ipv6Count);
    const v2rayText = peerCount === 1 ? generateV2RayURL(
        privateKey,
        data.config.peers[0].public_key,
        data.config.interface.addresses.v4,
        data.config.interface.addresses.v6,
        reserved,
        endpoint
    ) : 'V2Ray format is not supported for more than 1 peer.';

    updateDOM(wireGuardConfig, 'WireGuard Format', 'wireguardBox', wireGuardText, 'message1');
    updateDOM(v2rayConfig, 'V2Ray Format', 'v2rayBox', v2rayText, 'message2');
    downloadBtn.style.display = 'block';
    document.querySelectorAll('.copy-button').forEach(btn => {
        btn.addEventListener('click', handleCopyButtonClick);
    });
};

// Generate DNS-based WireGuard config
function generateDNSWireGuardConfig(data, privateKey) {
    let dnsServers;
    let title;
    switch (selectedPurpose) {
        case 'gaming':
            dnsServers = '78.157.42.101, 78.157.42.100'; // Electro
            title = 'WireGuard Format (Gaming)';
            break;
        case 'ai':
            dnsServers = selectedDNS === '403online' ? '10.202.10.202, 10.202.10.102' : '178.22.122.100, 185.51.200.2';
            title = 'WireGuard Format (AI & Development)';
            break;
    }

    const configText = `[Interface]
PrivateKey = ${privateKey}
Address = ${data.config.interface.addresses.v4}/32, ${data.config.interface.addresses.v6}/128
DNS = ${dnsServers}
MTU = 1280`;

    updateDOM(wireGuardConfig, title, 'wireguardBox', configText, 'message1');
    updateDOM(v2rayConfig, 'V2Ray Format', 'v2rayBox', 'V2Ray format is not supported for this configuration', 'message2');
    downloadBtn.style.display = 'block';
    document.querySelectorAll('.copy-button').forEach(btn => {
        btn.addEventListener('click', handleCopyButtonClick);
    });
};

// Get random endpoint
const getRandomEndpoint = (type = null) => {
    const endpointType = type || document.querySelector('input[name="endpoint"]:checked').value;
    const ipList = endpointType === 'ipv4' ? ipv4List : ipv6List;
    const randomIndex = Math.floor(Math.random() * ipList.length);
    return ipList[randomIndex];
};

// Generate WireGuard config for personal use
const generateWireGuardConfig = (data, privateKey, endpoint, peerCount, ipv4Count, ipv6Count) => {
    let configText = `[Interface]
PrivateKey = ${privateKey}
Address = ${data.config.interface.addresses.v4}/32, ${data.config.interface.addresses.v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

`;

    for (let i = 0; i < peerCount; i++) {
        const peerType = i < ipv4Count ? 'ipv4' : 'ipv6';
        const peerEndpoint = getRandomEndpoint(peerType);
        configText += `[Peer]
PublicKey = bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${peerEndpoint}

`;
    }

    return configText.trim();
};

// Generate reserved bytes
const generateReserved = (clientId) =>
    Array.from(atob(clientId))
        .map((char) => char.charCodeAt(0))
        .slice(0, 3)
        .join('%2C');

// Generate V2Ray URL
const generateV2RayURL = (privateKey, publicKey, ipv4, ipv6, reserved, endpoint) =>
    `wireguard://${encodeURIComponent(privateKey)}@${endpoint}?address=${encodeURIComponent(
        ipv4 + '/32'
    )},${encodeURIComponent(ipv6 + '/128')}&reserved=${reserved}&publickey=${encodeURIComponent(
        publicKey
    )}&mtu=1420#V2ray-Config`;

// Update DOM
const updateDOM = (container, title, textareaId, content, messageId) => {
    container.innerHTML = `
        <h2>${title}</h2>
        <textarea id="${textareaId}" readonly>${content.trim()}</textarea>
        <button class="copy-button" data-target="${textareaId}" data-message="${messageId}">Copy ${title} Config</button>
        <p id="${messageId}" aria-live="polite"></p>
    `;
};

// Show spinner
const showSpinner = () => {
    const spinner = document.querySelector('.spinner');
    const main = document.querySelector('main');
    if (spinner && main) {
        spinner.style.display = 'flex';
        main.style.display = 'none';
    }
};

// Hide spinner
const hideSpinner = () => {
    const spinner = document.querySelector('.spinner');
    const main = document.querySelector('main');
    if (spinner && main) {
        spinner.style.display = 'none';
        main.style.display = 'block';
    }
};

// Handle copy button click
const handleCopyButtonClick = async function(e) {
    const targetId = this.getAttribute('data-target');
    const messageId = this.getAttribute('data-message');
    try {
        const textArea = document.getElementById(targetId);
        await navigator.clipboard.writeText(textArea.value);
        showPopup('Config copied successfully!');
        showCopyMessage(messageId, 'Copied!', 'success');
    } catch (error) {
        console.error('Copy failed:', error);
        showPopup('Failed to copy, please try again.', 'error');
        showCopyMessage(messageId, 'Failed to copy', 'error');
    }
};

// Show copy message
const showCopyMessage = (messageId, message, type = 'success') => {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.color = type === 'success' ? '#28a745' : '#dc3545';
        messageElement.style.fontWeight = 'bold';
        setTimeout(() => {
            messageElement.textContent = '';
        }, 2000);
    }
};

// Show popup
const showPopup = (message, type = 'success') => {
    const popup = document.createElement('div');
    popup.textContent = message;
    popup.classList.add('popup-message');
    if (type === 'error') {
        popup.classList.add('error');
    }
    document.body.appendChild(popup);
    setTimeout(() => {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 2500);
};

// Generate random string
const generateRandomString = (length) =>
    Array.from({ length }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
            Math.floor(Math.random() * 62)
        )
    ).join('');

// Download config
downloadBtn.addEventListener('click', () => {
    const content = document.querySelector('#wireguardBox')?.value || "No configuration available";
    if (content === "No configuration available") {
        showPopup('No configuration to download', 'error');
        return;
    }
    downloadConfig('wireguard.conf', content);
    showPopup('Configuration file downloaded');
});

const downloadConfig = (fileName, content) => {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'application/octet-stream' });
    element.href = URL.createObjectURL(file);
    const finalFileName = fileName.endsWith('.conf') ? fileName : `${fileName}.conf`;
    element.download = finalFileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

// Peer count change handler
peerCountInput.addEventListener('change', () => {
    const peerCount = parseInt(peerCountInput.value);
    if (peerCount > 1) {
        ipDistributionDiv.style.display = 'block';
        ipv4CountInput.setAttribute('max', peerCount);
        ipv6CountInput.setAttribute('max', peerCount);
    } else {
        ipDistributionDiv.style.display = 'none';
    }
});
