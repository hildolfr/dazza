# Dazza Chat Widget

A reusable Web Component that provides a live chat interface for the Dazza bot system. The widget connects to the CyTube chat room and displays real-time messages with a VB (Victoria Bitter) themed UI.

## Features

- 🎯 **Web Component** - Fully encapsulated with Shadow DOM
- 💬 **Real-time Chat** - WebSocket connection for live messages
- 🎨 **Themeable** - CSS custom properties for easy styling
- 📍 **Flexible Positioning** - Four corner positions available
- 📱 **Responsive** - Works on mobile and desktop
- 🔄 **Auto-reconnect** - Handles connection drops gracefully
- 🛡️ **XSS Protection** - HTML escaping and content filtering
- 🎪 **Custom Events** - Integration with parent applications

## Quick Start

### Basic Usage

1. Include Socket.IO (required dependency):
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
```

2. Include the chat widget:
```html
<script src="/docs/shared/chat-widget/index.js"></script>
```

3. Add the widget to your page:
```html
<dazza-chat-widget position="bottom-right" theme="vb"></dazza-chat-widget>
```

### ES Module Usage

```javascript
import { ChatWidget } from '/docs/shared/chat-widget/index.js';

// Widget will auto-register as <dazza-chat-widget>
const widget = document.querySelector('dazza-chat-widget');
```

## Configuration

### Attributes

| Attribute | Values | Default | Description |
|-----------|--------|---------|-------------|
| `position` | `bottom-right`, `bottom-left`, `top-right`, `top-left` | `bottom-right` | Widget position on screen |
| `theme` | `vb`, `default` | `default` | Visual theme |
| `start-minimized` | `true`, `false` | `false` | Start in minimized state |

### CSS Custom Properties

```css
dazza-chat-widget {
  --chat-primary-color: #006a4e;    /* Header background */
  --chat-secondary-color: #ffcd00;  /* Accent color */
  --chat-width: 350px;              /* Widget width */
  --chat-height: 300px;             /* Message area height */
  --chat-bg-color: white;           /* Background color */
  --chat-text-color: #333;          /* Text color */
}
```

## API

### Properties

- `connected` (readonly) - WebSocket connection status
- `minimized` (readonly) - Current minimized state
- `messageCount` (readonly) - Number of messages displayed

### Methods

- `minimize()` - Minimize the widget
- `maximize()` - Maximize the widget

### Events

The widget emits the following custom events:

```javascript
// Connection established
widget.addEventListener('chat-connected', (e) => {
  console.log('Connected to chat');
});

// Connection lost
widget.addEventListener('chat-disconnected', (e) => {
  console.log('Disconnected from chat');
});

// New message received
widget.addEventListener('chat-message-received', (e) => {
  console.log('Message:', e.detail.username, e.detail.message);
});

// Widget toggled
widget.addEventListener('chat-toggle', (e) => {
  console.log('Minimized:', e.detail.minimized);
});
```

## Architecture

The widget is built using modern Web Components with a modular architecture:

```
chat-widget/
├── index.js                # Entry point & registration
├── chat-widget.js          # Main Web Component class
├── chat-widget-styles.js   # Encapsulated styles
├── chat-widget-template.js # HTML templates
├── chat-widget-api.js      # API client
├── chat-widget-socket.js   # WebSocket handler
└── chat-widget-messages.js # Message rendering
```

### Module Responsibilities

- **chat-widget.js** - Component lifecycle, state management
- **chat-widget-styles.js** - Shadow DOM styles with theming
- **chat-widget-template.js** - HTML structure generation
- **chat-widget-api.js** - REST API communication
- **chat-widget-socket.js** - WebSocket connection & events
- **chat-widget-messages.js** - Message filtering & rendering

## Message Filtering

The widget automatically filters out:
- Bot commands (messages starting with `!`)
- Server/system messages
- Messages longer than 500 characters

## Browser Support

Requires modern browsers with Web Components support:
- Chrome/Edge 63+
- Firefox 63+
- Safari 10.1+

## Development

### Testing

Open `test.html` in a browser to see an interactive demo with controls for testing all widget features.

### Adding to New Pages

1. Ensure Socket.IO is loaded
2. Add the widget script
3. Place the widget element where needed
4. Configure with attributes as required

### Example Integration

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
    <style>
        /* Custom theme */
        dazza-chat-widget {
            --chat-primary-color: #0066cc;
            --chat-width: 400px;
        }
    </style>
</head>
<body>
    <h1>My Content</h1>
    
    <!-- Socket.IO -->
    <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
    
    <!-- Chat Widget -->
    <script src="/docs/shared/chat-widget/index.js"></script>
    
    <!-- Widget Element -->
    <dazza-chat-widget 
        position="bottom-left" 
        theme="vb"
        start-minimized="true">
    </dazza-chat-widget>
</body>
</html>
```

## Security

- All user input is HTML-escaped
- Shadow DOM provides style encapsulation
- Content Security Policy compatible
- No external dependencies besides Socket.IO

## License

Part of the Dazza bot system - see main project license.