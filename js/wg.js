// Select DOM elements for buttons, configuration containers, and the main container
const getConfigBtn = document.querySelector('.get-btn');
const downloadBtn = document.querySelector('.download-btn');
const wireGuardConfig = document.querySelector('.wire-guard-config');
const v2rayConfig = document.querySelector('.v2ray-config');

let ipv4List = [];
let ipv6List = [];

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

// Add a click event listener to the "Get Free Config" button
getConfigBtn.addEventListener('click', async () => {
    getConfigBtn.disabled = true;
    getConfigBtn.textContent = 'Generating...';
    try {
        showSpinner();
        await loadIPLists(); // Ensure IP lists are loaded
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
        getConfigBtn.textContent = 'Get Free Config';
        setTimeout(() => {
            if (wireGuardConfig.firstChild) {
                wireGuardConfig.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }
});

// Function to fetch public and private keys from the server
const fetchKeys = async () => {
    try {
        const response = await fetch('https://wg-key.forvps.gq');
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

// Helper function to extract a specific key from a string using regex
const extractKey = (data, keyName) =>
    data.match(new RegExp(`${keyName}:\\s(.+)`))?.[1].trim() || null;

// Function to fetch account data from the server
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

// Function to generate WireGuard and V2Ray configurations
const generateConfig = (data, privateKey) => {
    const reserved = generateReserved(data.config.client_id);
    const endpoint = getRandomEndpoint();
    const wireGuardText = generateWireGuardConfig(data, privateKey, endpoint);
    const v2rayText = generateV2RayURL(
        privateKey,
        data.config.peers[0].public_key,
        data.config.interface.addresses.v4,
        data.config.interface.addresses.v6,
        reserved,
        endpoint
    );
    updateDOM(wireGuardConfig, 'WireGuard Format', 'wireguardBox', wireGuardText, 'message1');
    updateDOM(v2rayConfig, 'V2Ray Format', 'v2rayBox', v2rayText, 'message2');
    downloadBtn.style.display = 'block';
    document.querySelectorAll('.copy-button').forEach(btn => {
        btn.addEventListener('click', handleCopyButtonClick);
    });
};

// Function to get a random endpoint based on user selection
const getRandomEndpoint = () => {
    const endpointType = document.querySelector('input[name="endpoint"]:checked').value;
    const ipList = endpointType === 'ipv4' ? ipv4List : ipv6List;
    const randomIndex = Math.floor(Math.random() * ipList.length);
    return ipList[randomIndex];
};

// Function to generate WireGuard configuration text with the selected endpoint
const generateWireGuardConfig = (data, privateKey, endpoint) => `
[Interface]
PrivateKey = ${privateKey}
Address = ${data.config.interface.addresses.v4}/32, ${data.config.interface.addresses.v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280

[Peer]
PublicKey = ${data.config.peers[0].public_key}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
`;

// Function to generate reserved bytes from the client ID
const generateReserved = (clientId) =>
    Array.from(atob(clientId))
        .map((char) => char.charCodeAt(0))
        .slice(0, 3)
        .join('%2C');

// Function to generate V2Ray configuration URL with the selected endpoint
const generateV2RayURL = (privateKey, publicKey, ipv4, ipv6, reserved, endpoint) =>
    `wireguard://${encodeURIComponent(privateKey)}@${endpoint}?address=${encodeURIComponent(
        ipv4 + '/32'
    )},${encodeURIComponent(ipv6 + '/128')}&reserved=${reserved}&publickey=${encodeURIComponent(
        publicKey
    )}&mtu=1420#V2ray-Config`;

// Function to update the DOM with configuration text and buttons
const updateDOM = (container, title, textareaId, content, messageId) => {
    container.innerHTML = `
        <h2>${title}</h2>
        <textarea id="${textareaId}" readonly>${content.trim()}</textarea>
        <button class="copy-button" data-target="${textareaId}" data-message="${messageId}">Copy ${title} Config</button>
        <p id="${messageId}" aria-live="polite"></p>
    `;
};

// Function to show the spinner and hide the main content
const showSpinner = () => {
    const spinner = document.querySelector('.spinner');
    const main = document.querySelector('main');
    if (spinner && main) {
        spinner.style.display = 'flex'; // Show the spinner
        main.style.display = 'none';   // Hide the main content
    }
};

// Function to hide the spinner and show the main content
const hideSpinner = () => {
    const spinner = document.querySelector('.spinner');
    const main = document.querySelector('main');
    if (spinner && main) {
        spinner.style.display = 'none'; // Hide the spinner
        main.style.display = 'block';   // Show the main content
    }
};

// Function to handle copy button clicks
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

// Function to display a copy success/failure message
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

// Function to show a popup message
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

// Function to generate a random string of a given length
const generateRandomString = (length) =>
    Array.from({ length }, () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
            Math.floor(Math.random() * 62)
        )
    ).join('');

// Add a click event listener to the download button
downloadBtn.addEventListener('click', () => {
    const content = document.querySelector('#wireguardBox')?.value || "No configuration available";
    if (content === "No configuration available") {
        showPopup('No configuration to download', 'error');
        return;
    }
    downloadConfig('wireguard.conf', content);
    showPopup('Configuration file downloaded');
});

// Function to download a configuration file
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