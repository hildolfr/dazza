# Chat Widget Auto-Scroll Troubleshooting

The chat widget has auto-scroll enabled by default, but if it's not working properly, here are some solutions:

## 1. Check Widget Initialization

Make sure the widget is properly initialized with autoScroll enabled:

```javascript
// The widget already has autoScroll: true by default
// But you can explicitly ensure it's enabled when creating the widget
const widget = document.createElement('chat-widget');
widget.setAttribute('position', 'bottom-right');
widget.setAttribute('theme', 'light');
document.body.appendChild(widget);
```

## 2. Force Scroll After Widget Loads

If the auto-scroll isn't working due to timing issues, you can manually trigger a scroll:

```javascript
// Wait for widget to be fully loaded
widget.addEventListener('chat-connected', () => {
    // Force scroll to bottom after connection
    const messagesContainer = widget.shadowRoot.querySelector('.chat-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});

// Also scroll on new messages
widget.addEventListener('chat-message-received', () => {
    setTimeout(() => {
        const messagesContainer = widget.shadowRoot.querySelector('.chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 100); // Small delay to ensure DOM is updated
});
```

## 3. CSS Height Issues

Sometimes auto-scroll doesn't work if the messages container doesn't have a fixed height. Check that the `.chat-messages` container has proper CSS:

```css
.chat-messages {
    height: 300px; /* or whatever height you need */
    overflow-y: auto;
    overflow-x: hidden;
}
```

## 4. Enhanced Auto-Scroll with User Interaction Detection

If you want more advanced auto-scroll behavior (e.g., don't auto-scroll if user has scrolled up to read history), you can add this enhancement:

```javascript
// Add this to your page after the widget is loaded
function enhanceAutoScroll(widget) {
    const messagesContainer = widget.shadowRoot.querySelector('.chat-messages');
    let userHasScrolled = false;
    
    // Detect if user has manually scrolled
    messagesContainer.addEventListener('scroll', () => {
        const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 50;
        userHasScrolled = !isAtBottom;
    });
    
    // Override message handling to respect user scroll
    widget.addEventListener('chat-message-received', () => {
        if (!userHasScrolled) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    });
}

// Use it after widget is connected
widget.addEventListener('chat-connected', () => {
    enhanceAutoScroll(widget);
});
```

## 5. Debug Auto-Scroll Issues

To debug why auto-scroll might not be working:

```javascript
// Check if messages are being rendered
widget.addEventListener('chat-message-received', (e) => {
    console.log('New message received:', e.detail);
    
    const messagesContainer = widget.shadowRoot.querySelector('.chat-messages');
    console.log('Container height:', messagesContainer.clientHeight);
    console.log('Scroll height:', messagesContainer.scrollHeight);
    console.log('Current scroll position:', messagesContainer.scrollTop);
    
    // Check if ChatMessages instance has autoScroll enabled
    if (widget.messages) {
        console.log('AutoScroll enabled:', widget.messages.options.autoScroll);
    }
});
```

## 6. Force Enable Auto-Scroll

If needed, you can directly access the ChatMessages instance and ensure autoScroll is enabled:

```javascript
// After widget is loaded
if (widget.messages) {
    widget.messages.options.autoScroll = true;
}
```

## Summary

The chat widget should auto-scroll by default. If it's not working:
1. Check that the messages container has a fixed height
2. Ensure no CSS is interfering with the scroll behavior
3. Use the event listeners to manually trigger scrolling if needed
4. Check the browser console for any errors

The auto-scroll functionality in `chat-widget-messages.js` line 150-152 should handle this automatically whenever new messages are rendered.