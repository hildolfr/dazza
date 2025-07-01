// Chat widget styles for Shadow DOM encapsulation
export const chatWidgetStyles = `
  /* CSS Custom Properties with defaults */
  :host {
    --chat-primary-color: #006a4e;
    --chat-secondary-color: #ffcd00;
    --chat-width: 350px;
    --chat-height: 300px;
    --chat-bg-color: white;
    --chat-text-color: #333;
    
    /* Internal variables based on VB theme */
    --vb-green: #00954f;
    --vb-gold: #ffc72c;
    --vb-dark: #1a1a1a;
    --header-height: 50px;
    --message-slide-distance: 100%;
    
    /* Ensure host doesn't affect page layout */
    display: block;
    position: absolute;
    width: 0;
    height: 0;
    overflow: visible;
  }

  /* Reset styles for Shadow DOM */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* Main chat widget container */
  .chat-container {
    position: fixed;
    width: var(--chat-width);
    height: auto;
    max-height: calc(var(--chat-height) + var(--header-height));
    background: var(--chat-bg-color);
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    z-index: 1000;
    transition: all 0.3s ease;
    font-family: 'Arial', sans-serif;
    display: flex;
    flex-direction: column;
  }

  /* Position variants */
  .chat-container[data-position="bottom-right"] {
    bottom: 20px;
    right: 20px;
  }

  .chat-container[data-position="bottom-left"] {
    bottom: 20px;
    left: 20px;
  }

  .chat-container[data-position="top-right"] {
    top: 20px;
    right: 20px;
  }

  .chat-container[data-position="top-left"] {
    top: 20px;
    left: 20px;
  }

  /* Minimized state */
  .chat-container.minimized {
    height: var(--header-height) !important;
    max-height: var(--header-height) !important;
  }

  .chat-container.minimized .chat-body,
  .chat-container.minimized .chat-messages,
  .chat-container.minimized .chat-placeholder {
    display: none;
  }

  /* Chat header */
  .chat-header {
    background: var(--chat-primary-color);
    color: white;
    padding: 15px;
    height: var(--header-height);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    position: relative;
    overflow: hidden;
  }

  /* VB-style header gradient */
  .chat-header::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      transparent 0%, 
      rgba(255, 205, 0, 0.1) 50%, 
      transparent 100%
    );
    pointer-events: none;
  }

  .chat-header-content {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    position: relative;
    z-index: 1;
  }

  .chat-title {
    font-weight: bold;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 0.9rem;
  }
  
  .chat-user-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 8px;
    border-radius: 12px;
    transition: all 0.3s ease;
  }
  
  .chat-user-count:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  
  .user-count-icon {
    font-size: 0.9rem;
  }
  
  .user-count-text {
    font-weight: 600;
  }
  
  .chat-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    margin-left: auto;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffcd00;
    transition: all 0.3s ease;
  }
  
  .chat-status[data-status="connected"] .status-dot {
    background: #4caf50;
    box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
  }
  
  .chat-status[data-status="connecting"] .status-dot {
    background: #ffcd00;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  .chat-status[data-status="disconnected"] .status-dot,
  .chat-status[data-status="error"] .status-dot {
    background: #f44336;
  }
  
  .status-text {
    opacity: 0.9;
  }

  .chat-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: transform 0.3s ease;
    position: relative;
    z-index: 1;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .chat-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .toggle-icon {
    display: block;
    line-height: 1;
  }

  .chat-container.minimized .chat-toggle .toggle-icon {
    transform: rotate(45deg);
  }

  /* Chat body container */
  .chat-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: var(--chat-height);
    overflow: hidden;
  }

  /* Messages container */
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    background: #fafafa;
    position: relative;
  }

  /* Custom scrollbar for webkit browsers */
  .chat-messages::-webkit-scrollbar {
    width: 8px;
  }

  .chat-messages::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  .chat-messages::-webkit-scrollbar-thumb {
    background: var(--chat-primary-color);
    border-radius: 4px;
    opacity: 0.7;
  }

  .chat-messages::-webkit-scrollbar-thumb:hover {
    opacity: 1;
  }

  /* Individual message */
  .chat-message {
    margin-bottom: 10px;
    padding: 10px 12px;
    background: var(--chat-bg-color);
    border-radius: 10px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    animation: slideIn 0.3s ease-out;
    position: relative;
    overflow: hidden;
  }

  /* Message slide-in animation */
  @keyframes slideIn {
    from { 
      transform: translateX(var(--message-slide-distance)); 
      opacity: 0; 
    }
    to { 
      transform: translateX(0); 
      opacity: 1; 
    }
  }

  /* Adjust slide direction based on position */
  .chat-widget[data-position="bottom-left"] .chat-message,
  .chat-widget[data-position="top-left"] .chat-message {
    --message-slide-distance: -100%;
  }

  /* Username styling */
  .chat-username {
    font-weight: bold;
    color: var(--chat-primary-color);
    margin-right: 5px;
    display: inline-block;
  }

  /* Message text */
  .chat-text {
    color: var(--chat-text-color);
    word-wrap: break-word;
    display: inline;
    line-height: 1.4;
  }

  /* Timestamp */
  .chat-time {
    font-size: 0.75rem;
    color: #999;
    float: right;
    margin-left: 10px;
    margin-top: 2px;
  }

  /* Loading state */
  .chat-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--chat-height);
    color: #999;
    font-style: italic;
    flex-direction: column;
    gap: 10px;
  }

  /* Loading spinner */
  .chat-loading::before {
    content: '<z';
    font-size: 2rem;
    animation: spin 2s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Hover effects */
  .chat-message:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
    transition: all 0.2s ease;
  }

  /* VB Gold accent on hover */
  .chat-message:hover::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--chat-secondary-color);
    opacity: 0.8;
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    :host {
      --chat-width: calc(100vw - 40px);
      --chat-height: 250px;
    }

    .chat-widget[data-position="bottom-right"],
    .chat-widget[data-position="bottom-left"],
    .chat-widget[data-position="top-right"],
    .chat-widget[data-position="top-left"] {
      left: 20px;
      right: 20px;
      width: auto;
    }
  }

  /* Empty state */
  .chat-messages:empty::after {
    content: 'No messages yet, mate!';
    display: block;
    text-align: center;
    color: #999;
    padding: 50px 20px;
    font-style: italic;
  }

  /* Connection status indicator */
  .connection-status {
    position: absolute;
    top: 50%;
    right: 50px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4caf50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
  }

  .connection-status.disconnected {
    background: #f44336;
    box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.3);
  }

  .connection-status.connecting {
    background: var(--chat-secondary-color);
    box-shadow: 0 0 0 2px rgba(255, 205, 0, 0.3);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Focus styles for accessibility */
  .chat-toggle:focus-visible {
    outline: 2px solid var(--chat-secondary-color);
    outline-offset: 2px;
  }

  /* Print styles */
  @media print {
    .chat-widget {
      display: none;
    }
  }
`;