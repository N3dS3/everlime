function formatEmailQuery(emailFrom, emailTo, emailSubject, emailBody) {
  console.log('formatEmailQuery: Called with:', { emailFrom, emailTo, emailSubject, emailBody: emailBody?.substring(0, 100) + '...' });
  
  const emailContent = `From: ${emailFrom}
To: ${emailTo}
Subject: ${emailSubject}

${emailBody}`;
  console.log('formatEmailQuery: Formatted email content length:', emailContent.length);

  const prompt = `Please read the following email and generate a JSON response with plausible attachments that would make sense for this email. The JSON should have a key 'attachments' with a value that is a list of strings, each representing the file contents for a possible attachment.

Email:
${emailContent}

Please respond with only valid JSON in the format: {"attachments": ["file contents 1", "file contents 2", ...]}`;
  
  console.log('formatEmailQuery: Generated prompt length:', prompt.length);
  return prompt;
}

function extractAttachments(llmOutput) {
  console.log('extractAttachments: Called with output length:', llmOutput?.length);
  console.log('extractAttachments: First 200 chars of output:', llmOutput?.substring(0, 200));
  
  try {
    const jsonMatch = llmOutput.match(/\{.*"attachments".*\}/s);
    console.log('extractAttachments: JSON match found:', !!jsonMatch);
    
    if (!jsonMatch) {
      console.log('extractAttachments: No JSON match found, returning empty array');
      return [];
    }
    
    console.log('extractAttachments: Matched JSON:', jsonMatch[0]);
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('extractAttachments: Parsed JSON:', parsed);
    
    if (parsed.attachments && Array.isArray(parsed.attachments)) {
      console.log('extractAttachments: Found', parsed.attachments.length, 'attachments');
      return parsed.attachments;
    }
    
    console.log('extractAttachments: No valid attachments array found');
    return [];
  } catch (error) {
    console.error('extractAttachments: Error parsing JSON:', error);
    return [];
  }
}

async function queryClaude(apiKey, query) {
  console.log('queryClaude: Called with API key length:', apiKey?.length);
  console.log('queryClaude: Query length:', query?.length);
  
  const requestBody = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: query
    }]
  };
  
  console.log('queryClaude: Making request to Claude API...');
  console.log('queryClaude: Request body:', JSON.stringify(requestBody, null, 2));
  
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

  console.log('queryClaude: Response status:', response.status, response.statusText);
  console.log('queryClaude: Response ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('queryClaude: Error response body:', errorText);
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('queryClaude: Response data:', JSON.stringify(data, null, 2));
  console.log('queryClaude: Returning text:', data.content[0].text);
  return data.content[0].text;
}

async function generateEmailAttachments(apiKey, emailFrom, emailTo, emailSubject, emailBody) {
  console.log('generateEmailAttachments: Called with:', { 
    apiKeyLength: apiKey?.length,
    emailFrom, 
    emailTo, 
    emailSubject, 
    emailBodyLength: emailBody?.length 
  });
  
  console.log('generateEmailAttachments: Step 1 - Formatting query...');
  const query = formatEmailQuery(emailFrom, emailTo, emailSubject, emailBody);
  
  console.log('generateEmailAttachments: Step 2 - Querying Claude...');
  const llmOutput = await queryClaude(apiKey, query);
  
  console.log('generateEmailAttachments: Step 3 - Extracting attachments...');
  const attachments = extractAttachments(llmOutput);
  
  console.log('generateEmailAttachments: Final result - found', attachments?.length, 'attachments');
  return attachments;
}