async function getStoredApiKey() {
  console.log('getStoredApiKey: Attempting to retrieve API key from storage...');
  return new Promise((resolve) => {
    chrome.storage.sync.get(['claudeApiKey'], function(result) {
      console.log('getStoredApiKey: Storage result:', result);
      const apiKey = result.claudeApiKey || null;
      console.log('getStoredApiKey: Retrieved API key length:', apiKey?.length);
      console.log('getStoredApiKey: API key preview:', apiKey?.substring(0, 10) + '...');
      resolve(apiKey);
    });
  });
}

async function setApiKey(apiKey) {
  console.log('setApiKey: Attempting to store API key length:', apiKey?.length);
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ claudeApiKey: apiKey }, function() {
      if (chrome.runtime.lastError) {
        console.error('setApiKey: Error storing API key:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('setApiKey: Successfully stored API key');
        resolve();
      }
    });
  });
}