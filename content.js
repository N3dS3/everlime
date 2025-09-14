// EY todo - check if this works lol in particular this is supposed to fix emailData.to, cc, bcc, timestamp being undefined

(function() {
    'use strict';
  
    // Configuration object for easy customization
    const config = {
      // Delay before starting to look for send buttons (ms)
      initialDelay: 2000,
      // How often to check for new send buttons (ms)
      checkInterval: 1000,
      // Enable console logging
      debug: true,
      // Filename for the attached text file
      attachmentFilename: 'email_content.txt'
    };
  
    // Helper function to extract email content
    function extractEmailContent(composeBox) {
      console.log('extractEmailContent: Called with composeBox:', composeBox);
      const emailData = {
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
        timestamp: new Date().toISOString()
      };
      
      try {
        console.log('extractEmailContent: Starting email data extraction...');
        // Extract TO recipients - Gmail uses spans with email addresses
        console.log('extractEmailContent: Extracting TO recipients...');
        const toFields = composeBox.querySelectorAll('[name="to"] span[email], [aria-label*="To"] span[email], .vR span[email]');
        console.log('extractEmailContent: Found', toFields.length, 'TO field elements');
        const toEmails = Array.from(toFields).map(span => span.getAttribute('email')).filter(Boolean);
        console.log('extractEmailContent: Extracted TO emails:', toEmails);
        if (toEmails.length === 0) {
          // Fallback: try to get text from the To field
          console.log('extractEmailContent: No email spans found, trying fallback TO extraction...');
          const toDiv = composeBox.querySelector('[name="to"], [aria-label*="To"], .vR .aH9');
          console.log('extractEmailContent: TO fallback div:', toDiv);
          if (toDiv) {
            emailData.to = toDiv.innerText || toDiv.textContent || '';
            console.log('extractEmailContent: TO fallback result:', emailData.to);
          }
        } else {
          emailData.to = toEmails.join(', ');
        }
        console.log('extractEmailContent: Final TO value:', emailData.to);
        
        // Extract CC recipients
        const ccFields = composeBox.querySelectorAll('[name="cc"] span[email], [aria-label*="Cc"] span[email], .aB span[email]');
        const ccEmails = Array.from(ccFields).map(span => span.getAttribute('email')).filter(Boolean);
        if (ccEmails.length === 0) {
          // Fallback: try to get text from the CC field
          const ccDiv = composeBox.querySelector('[name="cc"], [aria-label*="Cc"], .aB .aH9');
          if (ccDiv) {
            emailData.cc = ccDiv.innerText || ccDiv.textContent || '';
          }
        } else {
          emailData.cc = ccEmails.join(', ');
        }
        
        // Extract BCC recipients
        const bccFields = composeBox.querySelectorAll('[name="bcc"] span[email], [aria-label*="Bcc"] span[email], .aC span[email]');
        const bccEmails = Array.from(bccFields).map(span => span.getAttribute('email')).filter(Boolean);
        if (bccEmails.length === 0) {
          // Fallback: try to get text from the BCC field
          const bccDiv = composeBox.querySelector('[name="bcc"], [aria-label*="Bcc"], .aC .aH9');
          if (bccDiv) {
            emailData.bcc = bccDiv.innerText || bccDiv.textContent || '';
          }
        } else {
          emailData.bcc = bccEmails.join(', ');
        }
        
        // Extract subject - multiple possible selectors
        console.log('extractEmailContent: Extracting subject...');
        const subjectSelectors = [
          '[name="subjectbox"]',
          '[aria-label*="Subject"]',
          'input[name="subject"]',
          '.aoT',
          '.az6 input'
        ];
        
        for (const selector of subjectSelectors) {
          console.log('extractEmailContent: Trying subject selector:', selector);
          const subjectField = composeBox.querySelector(selector);
          console.log('extractEmailContent: Subject field found:', !!subjectField);
          if (subjectField) {
            emailData.subject = subjectField.value || subjectField.innerText || subjectField.textContent || '';
            console.log('extractEmailContent: Extracted subject:', emailData.subject);
            if (emailData.subject) break;
          }
        }
        console.log('extractEmailContent: Final subject value:', emailData.subject);
        
        // Extract body - Gmail uses contenteditable div
        console.log('extractEmailContent: Extracting body...');
        const bodySelectors = [
          '[role="textbox"][aria-label*="Message Body"]',
          '[role="textbox"][g_editable="true"]',
          '.Am[role="textbox"]',
          '.editable[contenteditable="true"]',
          '[aria-label*="Message Body"]'
        ];
        
        for (const selector of bodySelectors) {
          console.log('extractEmailContent: Trying body selector:', selector);
          const bodyElement = composeBox.querySelector(selector);
          console.log('extractEmailContent: Body element found:', !!bodyElement);
          if (bodyElement) {
            emailData.body = bodyElement.innerText || bodyElement.textContent || '';
            console.log('extractEmailContent: Extracted body length:', emailData.body.length);
            console.log('extractEmailContent: Body preview:', emailData.body.substring(0, 100));
            if (emailData.body) break;
          }
        }
        console.log('extractEmailContent: Final body length:', emailData.body.length);
        
        // Debug logging to help diagnose issues
        console.log('extractEmailContent: Extraction complete, final email data:', emailData);
        if (config.debug) {
          console.log('Gmail Send Interceptor: Extracted email data:', emailData);
        }
        
        return emailData;
      } catch (error) {
        console.error('extractEmailContent: Error during extraction:', error);
        console.error('Gmail Send Interceptor: Error extracting email content', error);
        return null;
      }
    }
  
    // Function to create and attach multiple files
    function attachFiles(composeBox, attachments) {
      console.log('attachFiles: Called with', attachments?.length, 'attachments');
      return new Promise((resolve, reject) => {
        try {
          if (!attachments || attachments.length === 0) {
            console.log('attachFiles: No attachments provided, resolving with false');
            resolve(false);
            return;
          }

          console.log('attachFiles: Creating DataTransfer object...');
          // Create a DataTransfer object for drag and drop
          const dataTransfer = new DataTransfer();
          
          // Create files from attachment contents
          console.log('attachFiles: Creating files from attachments...');
          attachments.forEach((content, index) => {
            const blob = new Blob([content], { type: 'text/plain' });
            const filename = `attachment_${index + 1}.txt`;
            const file = new File([blob], filename, { type: 'text/plain' });
            console.log('attachFiles: Created file', filename, 'with size', file.size, 'bytes');
            dataTransfer.items.add(file);
          });
          console.log('attachFiles: Added', dataTransfer.items.length, 'files to DataTransfer');
          
          // Find the drop zone - usually the compose body or the entire compose box
          const dropTargets = [
            composeBox.querySelector('[role="textbox"][g_editable="true"]'),
            composeBox.querySelector('[role="textbox"]'),
            composeBox.querySelector('.Am'),
            composeBox.querySelector('.M9'),
            composeBox
          ].filter(Boolean);
          
          let attached = false;
          
          for (const dropZone of dropTargets) {
            if (attached) break;
            
            try {
              // Simulate drag and drop events
              const dragEnterEvent = new DragEvent('dragenter', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
              });
              dropZone.dispatchEvent(dragEnterEvent);
              
              const dragOverEvent = new DragEvent('dragover', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
              });
              dropZone.dispatchEvent(dragOverEvent);
              
              const dropEvent = new DragEvent('drop', {
                bubbles: true,
                cancelable: true,
                dataTransfer: dataTransfer
              });
              
              dropZone.dispatchEvent(dropEvent);
              
              // Also try to find any hidden file inputs and update them directly
              const fileInputs = document.querySelectorAll('input[type="file"]');
              fileInputs.forEach(input => {
                try {
                  // Check if this input is related to the compose box
                  if (composeBox.contains(input) || input.closest('.dw')) {
                    input.files = dataTransfer.files;
                    
                    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                    input.dispatchEvent(changeEvent);
                    
                    attached = true;
                  }
                } catch (e) {
                  // Some inputs might be protected
                }
              });
              
              attached = true;
              
            } catch (e) {
              console.log('Gmail Send Interceptor: Trying next drop target', e);
            }
          }
          
          if (!attached) {
            // Fallback: Try to programmatically trigger file input without UI
            const allFileInputs = document.querySelectorAll('input[type="file"]');
            for (const input of allFileInputs) {
              try {
                input.files = dataTransfer.files;
                const changeEvent = new Event('change', { bubbles: true });
                input.dispatchEvent(changeEvent);
                attached = true;
                break;
              } catch (e) {
                continue;
              }
            }
          }
          
          if (config.debug) {
            console.log('Gmail Send Interceptor: Text file attachment attempted');
          }
          
          // Give Gmail time to process the attachment
          setTimeout(() => resolve(attached), 1500);
          
        } catch (error) {
          console.error('Gmail Send Interceptor: Error attaching file', error);
          reject(error);
        }
      });
    }
  
    // Main handler for send button clicks
    async function onSendButtonClick(event) {
      // Find the compose box containing this send button
      const composeBox = event.target.closest('[role="dialog"], .dw, .nH .Hd');
      
      if (!composeBox) {
        console.error('Gmail Send Interceptor: Could not find compose box');
        return true;
      }
      
      // Prevent default sending temporarily
      event.stopPropagation();
      event.preventDefault();
      
      try {
        // Extract email content
        const emailData = extractEmailContent(composeBox);
        
        if (!emailData) {
          console.error('Gmail Send Interceptor: Could not extract email content');
          // Allow the email to send anyway
          setTimeout(() => event.target.click(), 100);
          return false;
        }
        
        if (config.debug) {
          console.log('Gmail Send Interceptor: Email data extracted');
        }
        
        if (config.debug) {
          console.log('Gmail Send Interceptor: Processing email with smart attachments...');
        }
        
        // Process email with smart attachments (check if needed, generate if so)
        console.log('onSendButtonClick: Sending message to background script for smart attachment processing...');
        
        let response;
        try {
          response = await chrome.runtime.sendMessage({
            action: 'processEmailWithSmartAttachments',
            emailFrom: 'user@gmail.com',
            emailTo: emailData.to,
            emailSubject: emailData.subject,
            emailBody: emailData.body
          });
        } catch (error) {
          if (error.message.includes('Extension context invalidated')) {
            console.log('onSendButtonClick: Extension context invalidated - please reload the page');
            alert('Extension was reloaded. Please refresh this page and try again.');
            return;
          }
          throw error;
        }
        
        console.log('onSendButtonClick: Received response from background script:', response);
        
        let attachments = [];
        if (response && response.success) {
          attachments = response.attachments || [];
          const attachmentNeeded = response.attachmentNeeded;
          
          console.log('onSendButtonClick: Smart processing result:', {
            attachmentNeeded: attachmentNeeded,
            attachmentsGenerated: attachments.length
          });
          
          if (attachmentNeeded && attachments.length === 0) {
            console.log('onSendButtonClick: Attachment was needed but none generated - proceeding anyway');
          } else if (attachmentNeeded && attachments.length > 0) {
            console.log('onSendButtonClick: Attachment needed and generated successfully');
          } else {
            console.log('onSendButtonClick: No attachment needed, proceeding without attachments');
          }
        } else {
          console.error('onSendButtonClick: Background script returned error:', response?.error);
          
          // If no API key, proceed without attachments
          if (response?.error && response.error.includes('No Claude API key found')) {
            console.log('onSendButtonClick: No API key configured, proceeding without attachments');
            attachments = [];
          } else {
            throw new Error(response?.error || 'Unknown error from background script');
          }
        }
        
        if (config.debug) {
          console.log('Gmail Send Interceptor: Generated attachments:', attachments);
        }
        
        // Attach files if any were generated
        console.log('onSendButtonClick: Checking if attachments were generated...');
        if (attachments && attachments.length > 0) {
          console.log('onSendButtonClick: Attaching', attachments.length, 'files...');
          const attachmentSuccess = await attachFiles(composeBox, attachments);
          console.log('onSendButtonClick: attachFiles returned:', attachmentSuccess);
          
          // Wait for attachment to complete
          console.log('onSendButtonClick: Waiting for attachment completion...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (config.debug) {
            console.log(`Gmail Send Interceptor: Attached ${attachments.length} files`);
          }
        } else {
          console.log('onSendButtonClick: No attachments generated, proceeding without attachments');
        }
        
        // Now trigger the actual send
        console.log('onSendButtonClick: Preparing to trigger actual send...');
        // Remove our interceptor temporarily to avoid infinite loop
        event.target.removeEventListener('click', onSendButtonClick, true);
        console.log('onSendButtonClick: Removed click listener');
        
        // Click the send button again
        setTimeout(() => {
          console.log('onSendButtonClick: Clicking send button...');
          event.target.click();
          // Re-attach the listener after a delay
          setTimeout(() => {
            console.log('onSendButtonClick: Re-attaching click listener');
            event.target.addEventListener('click', onSendButtonClick, true);
          }, 2000);
        }, 100);
        
      } catch (error) {
        console.error('onSendButtonClick: MAIN ERROR CAUGHT:', error);
        console.error('onSendButtonClick: Error stack:', error.stack);
        console.error('Gmail Send Interceptor: Error in send process', error);
        
        // Ask user if they want to send anyway
        console.log('onSendButtonClick: Asking user if they want to proceed...');
        const proceed = confirm(
          'Could not generate attachments using Claude.\n\n' +
          'Send email anyway?'
        );
        
        console.log('onSendButtonClick: User chose to proceed:', proceed);
        if (proceed) {
          console.log('onSendButtonClick: Proceeding with send after error...');
          event.target.removeEventListener('click', onSendButtonClick, true);
          setTimeout(() => {
            event.target.click();
            setTimeout(() => {
              event.target.addEventListener('click', onSendButtonClick, true);
            }, 2000);
          }, 100);
        }
      }
      
      return false;
    }
  
    // Function to attach listener to send buttons
    function attachSendButtonListeners() {
      console.log('attachSendButtonListeners: Called');
      // Gmail uses different selectors for send buttons depending on the view
      const sendButtonSelectors = [
        '[aria-label*="Send"][role="button"]',
        '[data-tooltip*="Send"]',
        '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3'
      ];
      
      console.log('attachSendButtonListeners: Using selectors:', sendButtonSelectors);
      let buttonsFound = 0;
      
      sendButtonSelectors.forEach(selector => {
        console.log('attachSendButtonListeners: Trying selector:', selector);
        const buttons = document.querySelectorAll(selector);
        console.log('attachSendButtonListeners: Found', buttons.length, 'buttons for selector:', selector);
        
        buttons.forEach((button, index) => {
          console.log('attachSendButtonListeners: Processing button', index, button);
          // Check if we've already attached a listener
          if (!button.hasAttribute('data-send-interceptor')) {
            console.log('attachSendButtonListeners: Attaching listener to new button');
            button.setAttribute('data-send-interceptor', 'true');
            
            // Attach the click listener with capture phase to intercept early
            button.addEventListener('click', onSendButtonClick, true);
            
            buttonsFound++;
            
            if (config.debug) {
              console.log('Gmail Send Interceptor: Attached listener to send button', button);
            }
          } else {
            console.log('attachSendButtonListeners: Button already has listener attached');
          }
        });
      });
      
      console.log('attachSendButtonListeners: Total buttons processed:', buttonsFound);
      if (config.debug && buttonsFound > 0) {
        console.log(`Gmail Send Interceptor: Found and processed ${buttonsFound} new send button(s)`);
      }
    }
  
    // Initialize the extension
    function initialize() {
      console.log('initialize: Starting extension initialization...');
      if (config.debug) {
        console.log('Gmail Send Interceptor: Initializing...');
      }
      
      console.log('initialize: Waiting', config.initialDelay, 'ms for Gmail to load...');
      // Wait for Gmail to load
      setTimeout(() => {
        console.log('initialize: Gmail load delay complete, scanning for send buttons...');
        // Initial scan for send buttons
        attachSendButtonListeners();
        
        console.log('initialize: Setting up MutationObserver...');
        // Set up observer for dynamically added compose windows
        const observer = new MutationObserver((mutations) => {
          console.log('MutationObserver: Detected', mutations.length, 'mutations');
          // Check if any relevant changes occurred
          const relevantChange = mutations.some(mutation => {
            const hasAddedNodes = mutation.addedNodes.length > 0;
            const isAttributeChange = mutation.type === 'attributes';
            console.log('MutationObserver: Mutation type:', mutation.type, 'addedNodes:', hasAddedNodes);
            return hasAddedNodes || isAttributeChange;
          });
          
          if (relevantChange) {
            console.log('MutationObserver: Relevant change detected, re-scanning for send buttons...');
            attachSendButtonListeners();
          }
        });
        
        // Start observing
        console.log('initialize: Starting MutationObserver on document.body...');
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-label', 'data-tooltip']
        });
        
        console.log('initialize: Extension fully initialized');
        if (config.debug) {
          console.log('Gmail Send Interceptor: Initialized successfully');
        }
      }, config.initialDelay);
    }
  
    // Start the extension when the page is ready
    console.log('CONTENT SCRIPT: Document ready state:', document.readyState);
    if (document.readyState === 'loading') {
      console.log('CONTENT SCRIPT: Document still loading, waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      console.log('CONTENT SCRIPT: Document ready, initializing immediately...');
      initialize();
    }
  })();