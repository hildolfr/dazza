/**
 * Dazza Chat Widget - Entry Point
 * 
 * This module provides the main entry point for the Dazza chat widget.
 * It can be used both as an ES module and as a regular script include.
 * 
 * Usage Examples:
 * 
 * 1. As an ES Module:
 *    ```javascript
 *    import { ChatWidget, initChatWidget } from './chat-widget/index.js';
 *    
 *    // Auto-initialize all widgets on the page
 *    initChatWidget();
 *    
 *    // Or create programmatically
 *    const widget = new ChatWidget();
 *    widget.setAttribute('room', 'fatpizza');
 *    document.body.appendChild(widget);
 *    ```
 * 
 * 2. As a Script Include:
 *    ```html
 *    <script src="/shared/chat-widget/index.js"></script>
 *    <script>
 *      // Auto-initialize on DOMContentLoaded
 *      DazzaChatWidget.init();
 *      
 *      // Or create programmatically
 *      const widget = new DazzaChatWidget.ChatWidget();
 *      widget.setAttribute('room', 'fatpizza');
 *      document.body.appendChild(widget);
 *    </script>
 *    ```
 * 
 * 3. Using the Custom Element:
 *    ```html
 *    <dazza-chat-widget 
 *      room="fatpizza" 
 *      theme="dark"
 *      position="bottom-right">
 *    </dazza-chat-widget>
 *    ```
 */

// Import the ChatWidget class
import ChatWidget from './chat-widget.js';

// Register the custom element if not already registered
if (!customElements.get('dazza-chat-widget')) {
  customElements.define('dazza-chat-widget', ChatWidget);
}

/**
 * Auto-initialize all chat widgets on the page
 * Finds all <dazza-chat-widget> elements and ensures they're initialized
 * 
 * @param {Object} options - Global initialization options
 * @param {boolean} options.autoOpen - Whether to auto-open widgets
 * @param {string} options.defaultRoom - Default room if not specified
 * @returns {ChatWidget[]} Array of initialized widget instances
 */
export function initChatWidget(options = {}) {
  const widgets = document.querySelectorAll('dazza-chat-widget');
  const instances = [];
  
  widgets.forEach(widget => {
    // Apply any global options that aren't already set as attributes
    if (options.autoOpen && !widget.hasAttribute('auto-open')) {
      widget.setAttribute('auto-open', 'true');
    }
    
    if (options.defaultRoom && !widget.hasAttribute('room')) {
      widget.setAttribute('room', options.defaultRoom);
    }
    
    instances.push(widget);
  });
  
  return instances;
}

/**
 * Create a new chat widget programmatically
 * 
 * @param {Object} config - Widget configuration
 * @param {string} config.room - Room name (default: 'fatpizza')
 * @param {string} config.theme - Theme: 'light' or 'dark' (default: 'dark')
 * @param {string} config.position - Position: 'bottom-right', 'bottom-left', etc.
 * @param {boolean} config.autoOpen - Whether to open automatically
 * @param {HTMLElement} config.container - Container element (default: document.body)
 * @returns {ChatWidget} The created widget instance
 */
export function createChatWidget(config = {}) {
  const widget = new ChatWidget();
  
  // Set attributes from config
  if (config.room) widget.setAttribute('room', config.room);
  if (config.theme) widget.setAttribute('theme', config.theme);
  if (config.position) widget.setAttribute('position', config.position);
  if (config.autoOpen) widget.setAttribute('auto-open', 'true');
  
  // Append to container
  const container = config.container || document.body;
  container.appendChild(widget);
  
  return widget;
}

// Export the ChatWidget class for programmatic use
export { ChatWidget };

// For non-module usage, expose on global object
if (typeof window !== 'undefined') {
  window.DazzaChatWidget = {
    ChatWidget,
    init: initChatWidget,
    create: createChatWidget
  };
  
  // Auto-initialize on DOMContentLoaded if widgets exist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const widgets = document.querySelectorAll('dazza-chat-widget');
      if (widgets.length > 0) {
        console.log(`[DazzaChatWidget] Auto-initializing ${widgets.length} widget(s)`);
        initChatWidget();
      }
    });
  } else {
    // DOM already loaded, check for widgets
    const widgets = document.querySelectorAll('dazza-chat-widget');
    if (widgets.length > 0) {
      console.log(`[DazzaChatWidget] Auto-initializing ${widgets.length} widget(s)`);
      initChatWidget();
    }
  }
}

// Default export for ES modules
export default ChatWidget;