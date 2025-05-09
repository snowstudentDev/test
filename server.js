// cors-proxy-browser.js
// A Node.js proxy server that bypasses CORS and provides a basic web browser interface

const express = require('express');
const http = require('http');
const https = require('https');
const { JSDOM } = require('jsdom');
const path = require('path');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (like CSS and client-side JS)
app.use(express.static('public'));

// Initialize basic HTML for the browser UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CORS Proxy Browser</title>
      <style>
        :root {
          --bg-dark: #1e1e1e;
          --text-dark: #e0e0e0;
          --control-bg: #2d2d2d;
          --control-border: #444;
          --control-hover: #444;
          --url-bar-bg: #333;
          --button-bg: #383838;
          --button-text: #e0e0e0;
          --loading-bg: rgba(255, 215, 0, 0.3);
        }
        
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          height: 100vh;
          background-color: var(--bg-dark);
          color: var(--text-dark);
          z-index: 9000;
        }
        #browser-controls {
          display: flex;
          padding: 10px;
          background-color: var(--control-bg);
          border-bottom: 1px solid var(--control-border);
        }
        #url-bar {
          flex-grow: 1;
          margin: 0 10px;
          padding: 5px 10px;
          border: 1px solid var(--control-border);
          border-radius: 3px;
          background-color: var(--url-bar-bg);
          color: var(--text-dark);
        }
        button {
          background-color: var(--button-bg);
          border: 1px solid var(--control-border);
          border-radius: 3px;
          padding: 5px 10px;
          cursor: pointer;
          margin-right: 5px;
          color: var(--button-text);
        }
        button:hover {
          background-color: var(--control-hover);
        }
        #content-frame {
          flex-grow: 1;
          border: none;
          width: 100%;
          height: calc(100% - 50px);
          background-color: var(--bg-dark);
        }
        #loading-indicator {
          display: none;
          position: fixed;
          top: 50px;
          left: 0;
          right: 0;
          text-align: center;
          background-color: var(--loading-bg);
          color: #000;
          padding: 5px;
          z-index: 1000;
        }
        #theme-toggle {
          padding: 3px 8px;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div id="browser-controls">
        <button id="back-button">←</button>
        <button id="forward-button">→</button>
        <button id="refresh-button">↻</button>
        <input type="text" id="url-bar" placeholder="Enter URL...">
        <button id="go-button">Go</button>
        <button id="close-button">Close</button>
        <button id="theme-toggle">Light</button>
      </div>
      <div id="loading-indicator">Loading...</div>
      <iframe id="content-frame" sandbox="allow-scripts allow-same-origin"></iframe>
      
      <script>
        const urlBar = document.getElementById('url-bar');
        const contentFrame = document.getElementById('content-frame');
        const loadingIndicator = document.getElementById('loading-indicator');
        const backButton = document.getElementById('back-button');
        const forwardButton = document.getElementById('forward-button');
        const refreshButton = document.getElementById('refresh-button');
        const goButton = document.getElementById('go-button');
        const closeButton = document.getElementById('close-button');
        const themeToggle = document.getElementById('theme-toggle');
        
        let history = [];
        let currentHistoryIndex = -1;
        let darkMode = true; // Start with dark mode by default
        
        // Function to navigate to a URL
        function navigateTo(url) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          
          urlBar.value = url;
          loadingIndicator.style.display = 'block';
          
          // Add to history if it's a new navigation (not back/forward)
          if (currentHistoryIndex === history.length - 1) {
            history.push(url);
            currentHistoryIndex++;
          }
          
          // Navigate using our proxy
          contentFrame.src = '/proxy?url=' + encodeURIComponent(url);
        }
        
        // Event listeners for navigation controls
        urlBar.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            navigateTo(urlBar.value);
          }
        });
        
        goButton.addEventListener('click', () => {
          navigateTo(urlBar.value);
        });
        
        backButton.addEventListener('click', () => {
          if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            urlBar.value = history[currentHistoryIndex];
            contentFrame.src = '/proxy?url=' + encodeURIComponent(history[currentHistoryIndex]);
          }
        });
        
        forwardButton.addEventListener('click', () => {
          if (currentHistoryIndex < history.length - 1) {
            currentHistoryIndex++;
            urlBar.value = history[currentHistoryIndex];
            contentFrame.src = '/proxy?url=' + encodeURIComponent(history[currentHistoryIndex]);
          }
        });
        
        refreshButton.addEventListener('click', () => {
          contentFrame.src = '/proxy?url=' + encodeURIComponent(urlBar.value);
        });
        
        closeButton.addEventListener('click', () => {
          contentFrame.src = 'about:blank';
          urlBar.value = '';
        });
        
        contentFrame.addEventListener('load', () => {
          loadingIndicator.style.display = 'none';
        });
        
        // Theme toggle functionality
        themeToggle.addEventListener('click', () => {
          darkMode = !darkMode;
          
          if (darkMode) {
            document.documentElement.style.setProperty('--bg-dark', '#1e1e1e');
            document.documentElement.style.setProperty('--text-dark', '#e0e0e0');
            document.documentElement.style.setProperty('--control-bg', '#2d2d2d');
            document.documentElement.style.setProperty('--control-border', '#444');
            document.documentElement.style.setProperty('--control-hover', '#444');
            document.documentElement.style.setProperty('--url-bar-bg', '#333');
            document.documentElement.style.setProperty('--button-bg', '#383838');
            document.documentElement.style.setProperty('--button-text', '#e0e0e0');
            themeToggle.textContent = 'Light';
          } else {
            document.documentElement.style.setProperty('--bg-dark', '#f5f5f5');
            document.documentElement.style.setProperty('--text-dark', '#333');
            document.documentElement.style.setProperty('--control-bg', '#e5e5e5');
            document.documentElement.style.setProperty('--control-border', '#ccc');
            document.documentElement.style.setProperty('--control-hover', '#ddd');
            document.documentElement.style.setProperty('--url-bar-bg', '#fff');
            document.documentElement.style.setProperty('--button-bg', '#fff');
            document.documentElement.style.setProperty('--button-text', '#333');
            themeToggle.textContent = 'Dark';
          }
          
          // Apply theme to iframe content if loaded
          applyThemeToIframe();
        });
        
        // Apply dark theme to iframe content
        function applyThemeToIframe() {
          try {
            if (contentFrame.contentDocument) {
              const iframeStyle = document.createElement('style');
              if (darkMode) {
                iframeStyle.textContent = `
                  html, body { background-color: #1e1e1e !important; }
                  body, p, div, span, h1, h2, h3, h4, h5, h6, li, td, th { color: #e0e0e0 !important; }
                  a { color: #3498db !important; }
                  input, textarea, select { background-color: #333 !important; color: #e0e0e0 !important; }
                  button { background-color: #383838 !important; color: #e0e0e0 !important; }
                `;
              } else {
                iframeStyle.textContent = '';
              }
              
              // Try to add the style to the iframe
              try {
                contentFrame.contentDocument.head.appendChild(iframeStyle);
              } catch (e) {
                console.log('Could not apply theme directly to iframe head');
              }
            }
          } catch (e) {
            console.log('Error applying theme to iframe', e);
          }
        }
        
        // Apply theme when iframe loads
        contentFrame.addEventListener('load', () => {
          loadingIndicator.style.display = 'none';
          applyThemeToIframe();
          
          // Capture and proxy clicks on buttons and form submissions
          try {
            const iframeDocument = contentFrame.contentDocument;
            
            if (iframeDocument) {
              // Handle button clicks
              iframeDocument.addEventListener('click', (e) => {
                const isButton = e.target.tagName === 'BUTTON' || 
                                 (e.target.tagName === 'INPUT' && e.target.type === 'submit') ||
                                 (e.target.tagName === 'INPUT' && e.target.type === 'button');
                                 
                if (isButton) {
                  // Let the click continue naturally
                  // The proxy will handle any resulting navigation
                }
              });
              
              // Handle form submissions
              iframeDocument.addEventListener('submit', (e) => {
                const form = e.target;
                
                // Don't interfere with form submissions, let them proceed normally
                // The proxy will intercept any resulting navigation
              });
            }
          } catch (e) {
            console.log('Could not add event listeners to iframe', e);
          }
        });
        
        // Setup message listener for iframe communication
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'navigation') {
            navigateTo(event.data.url);
          }
        });
        
        // Start with a blank page
        contentFrame.src = 'about:blank';
      </script>
    </body>
    </html>
  `);
});

// Proxy endpoint to fetch and modify content
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    // Determine whether to use http or https
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    // Set proper request options with headers to simulate a browser
    const options = new URL(targetUrl);
    const requestOptions = {
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Referer': targetUrl
      }
    };
    
    protocol.get(options, (proxyRes) => {
      // Handle redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        
        // Handle relative URLs in redirects
        if (redirectUrl.startsWith('/')) {
          const urlObj = new URL(targetUrl);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        
        return res.redirect(`/proxy?url=${encodeURIComponent(redirectUrl)}`);
      }
      
      // Get content type to determine how to handle the response
      const contentType = proxyRes.headers['content-type'] || '';
      
      // Collect data chunks
      const chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks);
        
        // Handle different content types
        if (contentType.includes('text/html')) {
          // For HTML, modify links to go through our proxy
          let html = body.toString();
          
          // Parse HTML with cheerio
          const $ = cheerio.load(html);
          
          // Replace all links (both relative and absolute)
          $('a').each(function() {
            const href = $(this).attr('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
              } else if (!href.includes('://')) {
                // Handle relative URLs that don't start with /
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + href;
              }
              $(this).attr('href', `/proxy?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update image sources
          $('img').each(function() {
            const src = $(this).attr('src');
            if (src && !src.startsWith('data:')) {
              let fullUrl = src;
              if (src.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${src}`;
              } else if (!src.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + src;
              }
              $(this).attr('src', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update CSS links
          $('link[rel="stylesheet"]').each(function() {
            const href = $(this).attr('href');
            if (href) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
              } else if (!href.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + href;
              }
              $(this).attr('href', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update script sources
          $('script').each(function() {
            const src = $(this).attr('src');
            if (src) {
              let fullUrl = src;
              if (src.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${src}`;
              } else if (!src.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + src;
              }
              $(this).attr('src', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Add base target to open links in our frame
          $('head').append('<base target="_self">');
          
          // Preserve form functionality by updating action URLs
          $('form').each(function() {
            const action = $(this).attr('action');
            if (action) {
              let fullUrl = action;
              if (action.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${action}`;
              } else if (!action.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + action;
              }
              $(this).attr('action', `/proxy?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Add scripts to handle clicks on links and buttons
          $('body').append(`
            <script>
              // Handle link clicks
              document.addEventListener('click', function(e) {
                const link = e.target.closest('a');
                if (link && link.href && !link.href.startsWith('javascript:')) {
                  e.preventDefault();
                  window.parent.postMessage({
                    type: 'navigation',
                    url: link.href
                  }, '*');
                }
              });
              
              // Capture form submissions
              document.addEventListener('submit', function(e) {
                const form = e.target;
                // Let the form submission proceed naturally
                // Our proxy will handle the navigation
              });
              
              // Fix for button click events
              const originalAddEventListener = EventTarget.prototype.addEventListener;
              EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type === 'click') {
                  const wrappedListener = function(event) {
                    // Call the original listener
                    const result = listener.call(this, event);
                    // Don't stop propagation of the event
                    return result;
                  };
                  return originalAddEventListener.call(this, type, wrappedListener, options);
                } else {
                  return originalAddEventListener.call(this, type, listener, options);
                }
              };
            </script>
          `);
          
          // Add dark mode styles if needed
          $('head').append(`
            <style id="proxy-dark-mode">
              /* Dark mode styles will be injected via JavaScript in the parent window */
            </style>
          `);
          
          // Send the modified HTML
          res.setHeader('Content-Type', 'text/html');
          res.send($.html());
        } else {
          // For non-HTML content, pass through as is
          res.setHeader('Content-Type', contentType);
          res.send(body);
        }
      });
    }).on('error', (err) => {
      console.error('Error fetching content:', err);
      res.status(500).send(`Error fetching content: ${err.message}`);
    });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send(`Proxy error: ${error.message}`);
  }
});

// Endpoint for proxying resources (images, CSS, JS, etc.)
app.get('/proxy-resource', (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    // Set proper request options with headers to simulate a browser
    const options = new URL(targetUrl);
    const requestOptions = {
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Referer': targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)
      }
    };
    
    protocol.get(options, (proxyRes) => {
      // Handle redirects for resources too
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        
        if (redirectUrl.startsWith('/')) {
          const urlObj = new URL(targetUrl);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        
        return res.redirect(`/proxy-resource?url=${encodeURIComponent(redirectUrl)}`);
      }
      
      // Set appropriate headers
      if (proxyRes.headers['content-type']) {
        res.setHeader('Content-Type', proxyRes.headers['content-type']);
      }
      
      // Pipe the response directly
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('Error fetching resource:', err);
      res.status(500).send(`Error fetching resource: ${err.message}`);
    });
  } catch (error) {
    console.error('Proxy resource error:', error);
    res.status(500).send(`Proxy resource error: ${error.message}`);
  }
});

// Add POST request handling for forms
app.post('/proxy', (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const options = new URL(targetUrl);
    
    const requestOptions = {
      hostname: options.hostname,
      path: options.pathname + options.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Referer': targetUrl,
        'Content-Length': Buffer.byteLength(JSON.stringify(req.body))
      }
    };
    
    const proxyReq = protocol.request(options, (proxyRes) => {
      // Handle redirects
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        
        if (redirectUrl.startsWith('/')) {
          const urlObj = new URL(targetUrl);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        
        return res.redirect(`/proxy?url=${encodeURIComponent(redirectUrl)}`);
      }
      
      // Get content type
      const contentType = proxyRes.headers['content-type'] || '';
      
      // Collect data chunks
      const chunks = [];
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      proxyRes.on('end', () => {
        // Process response similar to GET handler
        const body = Buffer.concat(chunks);
        
        if (contentType.includes('text/html')) {
          // Process HTML response as in the GET handler
          let html = body.toString();
          const $ = cheerio.load(html);
          
          // ... Same processing as in GET handler
          // Replace links, image sources, etc.
          $('a').each(function() {
            const href = $(this).attr('href');
            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
              } else if (!href.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + href;
              }
              $(this).attr('href', `/proxy?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update image sources
          $('img').each(function() {
            const src = $(this).attr('src');
            if (src && !src.startsWith('data:')) {
              let fullUrl = src;
              if (src.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${src}`;
              } else if (!src.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + src;
              }
              $(this).attr('src', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update CSS links
          $('link[rel="stylesheet"]').each(function() {
            const href = $(this).attr('href');
            if (href) {
              let fullUrl = href;
              if (href.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
              } else if (!href.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + href;
              }
              $(this).attr('href', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Update script sources
          $('script').each(function() {
            const src = $(this).attr('src');
            if (src) {
              let fullUrl = src;
              if (src.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                fullUrl = `${urlObj.protocol}//${urlObj.host}${src}`;
              } else if (!src.includes('://')) {
                let baseUrl = targetUrl;
                if (!baseUrl.endsWith('/')) {
                  baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
                }
                fullUrl = baseUrl + src;
              }
              $(this).attr('src', `/proxy-resource?url=${encodeURIComponent(fullUrl)}`);
            }
          });
          
          // Add base target and scripts as in GET handler
          $('head').append('<base target="_self">');
          
          // Add same scripts and form handling as in GET handler
          $('body').append(`
            <script>
              document.addEventListener('click', function(e) {
                const link = e.target.closest('a');
                if (link && link.href && !link.href.startsWith('javascript:')) {
                  e.preventDefault();
                  window.parent.postMessage({
                    type: 'navigation',
                    url: link.href
                  }, '*');
                }
              });
              
              const originalAddEventListener = EventTarget.prototype.addEventListener;
              EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (type === 'click') {
                  const wrappedListener = function(event) {
                    const result = listener.call(this, event);
                    return result;
                  };
                  return originalAddEventListener.call(this, type, wrappedListener, options);
                } else {
                  return originalAddEventListener.call(this, type, listener, options);
                }
              };
            </script>
          `);
          
          // Send the modified HTML
          res.setHeader('Content-Type', 'text/html');
          res.send($.html());
        } else {
          // For non-HTML content, pass through as is
          res.setHeader('Content-Type', contentType);
          res.send(body);
        }
      });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Error in POST proxy:', err);
      res.status(500).send(`Error in POST proxy: ${err.message}`);
    });
    
    // Send the request body
    proxyReq.write(JSON.stringify(req.body));
    proxyReq.end();
  } catch (error) {
    console.error('POST proxy error:', error);
    res.status(500).send(`POST proxy error: ${error.message}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`CORS Proxy Browser running on http://localhost:${PORT}`);
  console.log('Instructions:');
  console.log(`1. Open your browser and navigate to http://localhost:${PORT}`);
  console.log('2. Enter any URL in the address bar and click Go');
  console.log('3. Use the navigation buttons to browse the web without CORS restrictions');
  console.log('4. Toggle between dark and light theme with the theme button');
  console.log('5. Buttons and forms should now work properly');
});
