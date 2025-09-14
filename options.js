document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');

    function showStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${isError ? 'error' : 'success'}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    function loadStoredApiKey() {
        chrome.storage.sync.get(['claudeApiKey'], function(result) {
            if (result.claudeApiKey) {
                apiKeyInput.value = result.claudeApiKey;
            }
        });
    }

    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Please enter an API key', true);
            return;
        }

        if (!apiKey.startsWith('sk-ant-api03-')) {
            showStatus('API key should start with "sk-ant-api03-"', true);
            return;
        }

        chrome.storage.sync.set({
            claudeApiKey: apiKey
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('Error saving API key: ' + chrome.runtime.lastError.message, true);
            } else {
                showStatus('API key saved successfully!');
            }
        });
    }

    saveButton.addEventListener('click', saveApiKey);
    
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveApiKey();
        }
    });

    loadStoredApiKey();
});