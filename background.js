chrome.runtime.onInstalled.addListener(() => {
    console.log('Gmail Text Attachment: Extension installed');
});

// Storage functions - moved from content script since chrome.storage isn't available in content scripts
async function getStoredApiKey() {
  console.log('Background: getStoredApiKey - Attempting to retrieve API key from storage...');
  return new Promise((resolve) => {
    chrome.storage.sync.get(['claudeApiKey'], function(result) {
      console.log('Background: getStoredApiKey - Storage result:', result);
      const apiKey = result.claudeApiKey || null;
      console.log('Background: getStoredApiKey - Retrieved API key length:', apiKey?.length);
      console.log('Background: getStoredApiKey - API key preview:', apiKey?.substring(0, 10) + '...');
      resolve(apiKey);
    });
  });
}

async function setApiKey(apiKey) {
  console.log('Background: setApiKey - Attempting to store API key length:', apiKey?.length);
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ claudeApiKey: apiKey }, function() {
      if (chrome.runtime.lastError) {
        console.error('Background: setApiKey - Error storing API key:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('Background: setApiKey - Successfully stored API key');
        resolve();
      }
    });
  });
}

// Claude API functions moved from content script to avoid CORS issues
async function queryClaude(apiKey, query) {
  console.log('Background: queryClaude called with API key length:', apiKey?.length);
  console.log('Background: API key first 20 chars:', apiKey?.substring(0, 20) + '...');
  console.log('Background: API key starts with sk-ant-api03-:', apiKey?.startsWith('sk-ant-api03-'));
  console.log('Background: Query length:', query?.length);
  
  const requestBody = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: query
    }]
  };
  
  console.log('Background: Making request to Claude API...');
  console.log('Background: Request body:', JSON.stringify(requestBody, null, 2));
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify(requestBody)
  });

  console.log('Background: Response status:', response.status, response.statusText);
  console.log('Background: Response ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Background: Error response body:', errorText);
    console.error('Background: Request headers were:', JSON.stringify({
      'Content-Type': 'application/json',
      'X-API-Key': apiKey?.substring(0, 20) + '...',
      'anthropic-version': '2024-06-01'
    }));
    throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Background: Response data:', JSON.stringify(data, null, 2));
  console.log('Background: Returning text:', data.content[0].text);
  return data.content[0].text;
}

function formatEmailQuery(emailFrom, emailTo, emailSubject, emailBody) {
  console.log('Background: formatEmailQuery called with:', { emailFrom, emailTo, emailSubject, emailBody: emailBody?.substring(0, 100) + '...' });
  
  const emailContent = `From: ${emailFrom}
To: ${emailTo}
Subject: ${emailSubject}

${emailBody}`;
  console.log('Background: Formatted email content length:', emailContent.length);

  const prompt = `Please read the following email and generate a JSON response with plausible attachments that would make sense for this email. The JSON should have a key 'attachments' with a value that is a list of strings, each representing the file contents for a possible attachment.

Email:
${emailContent}

Please respond with only valid JSON in the format: {"attachments": ["file contents 1", "file contents 2", ...]}`;
  
  console.log('Background: Generated prompt length:', prompt.length);
  return prompt;
}

function formatAttachmentNeededQuery(emailFrom, emailTo, emailSubject, emailBody) {
  console.log('Background: formatAttachmentNeededQuery called with:', { emailFrom, emailTo, emailSubject, emailBody: emailBody?.substring(0, 100) + '...' });
  
  const emailContent = `From: ${emailFrom}
To: ${emailTo}
Subject: ${emailSubject}

${emailBody}`;
  console.log('Background: Formatted email content length:', emailContent.length);

  const prompt = `Please read the following email and determine if, based on the content, this email should have an attachment. Look for these indicators:

- References to attached files ("see attached", "please find attached", "attachment", "enclosed")
- Mentions of specific documents, reports, spreadsheets, images, or files by name
- Promises to send or share files ("I'm sending you", "here is the", "I've attached")
- Discussion of data, charts, presentations, contracts, or other file-based content
- Language suggesting something should be included but may be missing

Email:
${emailContent}

Based on the email content, does this email indicate that an attachment should be present?

Please respond with only valid JSON in the format: {"attachment_needed": true} or {"attachment_needed": false}`;
  
  console.log('Background: Generated attachment needed prompt length:', prompt.length);
  return prompt;
}

function extractAttachments(llmOutput) {
  console.log('Background: extractAttachments called with output length:', llmOutput?.length);
  console.log('Background: First 200 chars of output:', llmOutput?.substring(0, 200));
  
  try {
    const jsonMatch = llmOutput.match(/\{.*"attachments".*\}/s);
    console.log('Background: JSON match found:', !!jsonMatch);
    
    if (!jsonMatch) {
      console.log('Background: No JSON match found, returning empty array');
      return [];
    }
    
    console.log('Background: Matched JSON:', jsonMatch[0]);
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Background: Parsed JSON:', parsed);
    
    if (parsed.attachments && Array.isArray(parsed.attachments)) {
      console.log('Background: Found', parsed.attachments.length, 'attachments');
      return parsed.attachments;
    }
    
    console.log('Background: No valid attachments array found');
    return [];
  } catch (error) {
    console.error('Background: Error parsing JSON:', error);
    return [];
  }
}

function extractAttachmentNeeded(llmOutput) {
  console.log('Background: extractAttachmentNeeded called with output length:', llmOutput?.length);
  console.log('Background: First 200 chars of output:', llmOutput?.substring(0, 200));
  
  try {
    const jsonMatch = llmOutput.match(/\{.*"attachment_needed".*\}/s);
    console.log('Background: JSON match found:', !!jsonMatch);
    
    if (!jsonMatch) {
      console.log('Background: No JSON match found, returning false');
      return false;
    }
    
    console.log('Background: Matched JSON:', jsonMatch[0]);
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Background: Parsed JSON:', parsed);
    
    if (typeof parsed.attachment_needed === 'boolean') {
      console.log('Background: Found attachment_needed value:', parsed.attachment_needed);
      return parsed.attachment_needed;
    }
    
    console.log('Background: No valid attachment_needed boolean found');
    return false;
  } catch (error) {
    console.error('Background: Error parsing JSON:', error);
    return false;
  }
}

async function checkAttachmentNeeded(apiKey, emailFrom, emailTo, emailSubject, emailBody) {
  console.log('Background: checkAttachmentNeeded called with:', { 
    apiKeyLength: apiKey?.length,
    emailFrom, 
    emailTo, 
    emailSubject, 
    emailBodyLength: emailBody?.length 
  });
  
  console.log('Background: Step 1 - Formatting attachment needed query...');
  const query = formatAttachmentNeededQuery(emailFrom, emailTo, emailSubject, emailBody);
  
  console.log('Background: Step 2 - Querying Claude for attachment needed...');
  const llmOutput = await queryClaude(apiKey, query);
  
  console.log('Background: Step 3 - Extracting attachment needed result...');
  const attachmentNeeded = extractAttachmentNeeded(llmOutput);
  
  console.log('Background: Final result - attachment needed:', attachmentNeeded);
  return attachmentNeeded;
}

async function generateEmailAttachments(apiKey, emailFrom, emailTo, emailSubject, emailBody) {
  console.log('Background: generateEmailAttachments called with:', { 
    apiKeyLength: apiKey?.length,
    emailFrom, 
    emailTo, 
    emailSubject, 
    emailBodyLength: emailBody?.length 
  });
  
  console.log('Background: Step 1 - Formatting query...');
  const query = formatEmailQuery(emailFrom, emailTo, emailSubject, emailBody);
  
  console.log('Background: Step 2 - Querying Claude...');
  const llmOutput = await queryClaude(apiKey, query);
  
  console.log('Background: Step 3 - Extracting attachments...');
  const attachments = extractAttachments(llmOutput);
  
  console.log('Background: Final result - found', attachments?.length, 'attachments');
  return attachments;
}

async function processEmailWithSmartAttachments(apiKey, emailFrom, emailTo, emailSubject, emailBody) {
  console.log('Background: processEmailWithSmartAttachments called with:', { 
    apiKeyLength: apiKey?.length,
    emailFrom, 
    emailTo, 
    emailSubject, 
    emailBodyLength: emailBody?.length 
  });
  
  console.log('Background: Step 1 - Checking if attachment is needed...');
  const attachmentNeeded = await checkAttachmentNeeded(apiKey, emailFrom, emailTo, emailSubject, emailBody);
  
  if (!attachmentNeeded) {
    console.log('Background: No attachment needed, proceeding without attachments');
    return { attachments: [], attachmentNeeded: false };
  }
  
  console.log('Background: Attachment needed - generating attachments...');
  const attachments = await generateEmailAttachments(apiKey, emailFrom, emailTo, emailSubject, emailBody);
  
  console.log('Background: Final result - attachment needed:', attachmentNeeded, 'attachments generated:', attachments?.length);
  return { attachments: attachments || [], attachmentNeeded: true };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    console.log('Background: Received getApiKey request');
    
    getStoredApiKey().then(apiKey => {
      console.log('Background: Retrieved API key, sending response. Length:', apiKey?.length);
      sendResponse({ success: true, apiKey: apiKey });
    }).catch(error => {
      console.error('Background: Error getting API key:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'setApiKey') {
    console.log('Background: Received setApiKey request');
    
    setApiKey(request.apiKey).then(() => {
      console.log('Background: API key stored successfully');
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Background: Error setting API key:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'processEmailWithSmartAttachments') {
    console.log('Background: Received processEmailWithSmartAttachments request');
    
    // First get the API key, then process email with smart attachments
    getStoredApiKey().then(apiKey => {
      console.log('Background: Got API key for smart attachment processing, length:', apiKey?.length);
      
      if (!apiKey) {
        console.log('Background: No Claude API key found');
        sendResponse({ success: false, error: 'No Claude API key found. Please configure it in the extension options.' });
        return;
      }
      
      return processEmailWithSmartAttachments(
        apiKey,
        request.emailFrom,
        request.emailTo,
        request.emailSubject,
        request.emailBody
      );
    }).then(result => {
      console.log('Background: Smart attachment processing complete, sending response:', result);
      sendResponse({ 
        success: true, 
        attachments: result.attachments, 
        attachmentNeeded: result.attachmentNeeded 
      });
    }).catch(error => {
      console.error('Background: Error in smart attachment processing flow:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'generateAttachmentsWithEmail') {
    console.log('Background: Received generateAttachmentsWithEmail request');
    
    // First get the API key, then generate attachments
    getStoredApiKey().then(apiKey => {
      console.log('Background: Got API key for attachment generation, length:', apiKey?.length);
      
      if (!apiKey) {
        console.log('Background: No Claude API key found');
        sendResponse({ success: false, error: 'No Claude API key found. Please configure it in the extension options.' });
        return;
      }
      
      return generateEmailAttachments(
        apiKey,
        request.emailFrom,
        request.emailTo,
        request.emailSubject,
        request.emailBody
      );
    }).then(attachments => {
      console.log('Background: Generated attachments, sending response:', attachments);
      sendResponse({ success: true, attachments: attachments });
    }).catch(error => {
      console.error('Background: Error in attachment generation flow:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'sendEmail') {
    // Handle any other background processing here
    console.log('Email send intercepted from tab:', sender.tab.id);
    sendResponse({status: 'processed'});
  }
});
  