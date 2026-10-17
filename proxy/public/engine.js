let enginePromise;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}. Check the proxy server.`));
    document.head.append(script);
  });
}

async function createEngine() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) {
    throw new Error('This browser needs HTTPS, or localhost, with service workers enabled.');
  }
  const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) throw new Error('The browser service worker did not start.');
  for (const path of ['/engine/scramjet.js', '/engine/controller.api.js', '/engine/utils.js', '/engine/libcurl.js']) {
    await loadScript(path);
  }
  const wispUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/wisp/`;
  const transport = new window.LibcurlTransport.LibcurlClient({ wisp: wispUrl });
  const controller = new window.$scramjetController.Controller({
    serviceworker: worker,
    transport,
    config: {
      scramjetPath: '/engine/scramjet.js',
      injectPath: '/engine/controller.inject.js',
      wasmPath: '/engine/scramjet.wasm',
    },
  });
  await controller.wait();
  return controller;
}

export function getEngine() {
  if (!enginePromise) {
    enginePromise = createEngine().catch(error => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}
