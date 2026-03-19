/// <reference lib="webworker" />

export interface NetworkStatus {
  online: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  isSlow?: boolean;
}

let isVisible = true;
let checkTimeout: any;
let isChecking = false;
let intervalId: any;

function getCurrentStatus(): Partial<NetworkStatus> {
  const status: Partial<NetworkStatus> = {
    online: navigator.onLine
  };

  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    if (conn) {
      status.connectionType = conn.effectiveType;
      status.effectiveType = conn.effectiveType;
      status.downlink = conn.downlink;
      status.rtt = conn.rtt;
    }
  }
  return status;
}

function sendUpdate(extra: Partial<NetworkStatus> = {}) {
  const status = {
    ...getCurrentStatus(),
    ...extra
  };
  postMessage({
    type: 'NETWORK_UPDATE',
    payload: status
  });
}

function getPingUrl(): string {
  // Standard, lightweight endpoint for network checks
  return `https://www.gstatic.com/generate_204?t=${Date.now()}`;
}

async function verifyConnection(retryCount = 0): Promise<void> {
  if (isChecking && retryCount === 0) return;
  isChecking = true;

  if (!navigator.onLine) {
    sendUpdate({ online: false });
    isChecking = false;
    return;
  }

  const pingUrl = getPingUrl();

  try {
    const controller = new AbortController();
    const timeout = retryCount === 0 ? 2000 : 3000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    await fetch(pingUrl, {
      method: 'GET',
      mode: 'no-cors', // Fix CORS issues with cross-origin pings
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });

    clearTimeout(timeoutId);

    // In 'no-cors' mode, if the request resolves (doesn't throw), the network is accessible.
    sendUpdate({ online: true });
    isChecking = false;

  } catch (error) {
    if (retryCount < 1) {
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(() => {
        verifyConnection(retryCount + 1);
      }, 1000);
      return;
    }
    sendUpdate({ online: false });
    isChecking = false;
  }
}

function startInterval() {
  stopInterval();
  intervalId = setInterval(() => {
    if (isVisible) {
      verifyConnection();
    }
  }, 10000);
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Event Listeners
addEventListener('online', () => {
  sendUpdate({ online: true });
  verifyConnection();
});

addEventListener('offline', () => {
  sendUpdate({ online: false });
});

if ('connection' in navigator) {
  const conn = (navigator as any).connection;
  if (conn) {
    conn.addEventListener('change', () => {
      sendUpdate();
      verifyConnection();
    });
  }
}

// Message Handler from Main Thread
addEventListener('message', ({ data }) => {
  if (!data) return;
  const { type, payload } = data;

  if (type === 'INITIALIZE') {
    isVisible = payload.isVisible ?? true;
    sendUpdate(); // Send initial state
    verifyConnection(); // Start initial check
    startInterval();
  } else if (type === 'VISIBILITY_CHANGE') {
    isVisible = payload === 'visible';
    if (isVisible) {
      verifyConnection(); // Immediate check on resume
      startInterval();
    } else {
      stopInterval(); // Pause periodic checks in background to save battery
    }
  } else if (type === 'VERIFY_NOW') {
    verifyConnection();
  }
});
