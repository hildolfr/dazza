export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

export function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-AU', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Australia/Sydney'
    });
}

export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

export function truncateMessage(message, maxLength = 300) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
}

export function parseTimeString(timeStr) {
    const regex = /(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day)/gi;
    let totalMs = 0;
    let match;
    
    while ((match = regex.exec(timeStr)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit[0]) {
            case 's':
                totalMs += value * 1000;
                break;
            case 'm':
                totalMs += value * 60 * 1000;
                break;
            case 'h':
                totalMs += value * 60 * 60 * 1000;
                break;
            case 'd':
                totalMs += value * 24 * 60 * 60 * 1000;
                break;
        }
    }
    
    return totalMs;
}

export function toFancyText(text) {
    // Convert regular text to mathematical alphanumeric symbols (Gothic/Fraktur style)
    const charMap = {
        // Fraktur lowercase
        'a': '𝔞', 'b': '𝔟', 'c': '𝔠', 'd': '𝔡', 'e': '𝔢', 'f': '𝔣', 'g': '𝔤', 'h': '𝔥',
        'i': '𝔦', 'j': '𝔧', 'k': '𝔨', 'l': '𝔩', 'm': '𝔪', 'n': '𝔫', 'o': '𝔬', 'p': '𝔭',
        'q': '𝔮', 'r': '𝔯', 's': '𝔰', 't': '𝔱', 'u': '𝔲', 'v': '𝔳', 'w': '𝔴', 'x': '𝔵',
        'y': '𝔶', 'z': '𝔷',
        // Fraktur uppercase
        'A': '𝔄', 'B': '𝔅', 'C': 'ℭ', 'D': '𝔇', 'E': '𝔈', 'F': '𝔉', 'G': '𝔊', 'H': 'ℌ',
        'I': 'ℑ', 'J': '𝔍', 'K': '𝔎', 'L': '𝔏', 'M': '𝔐', 'N': '𝔑', 'O': '𝔒', 'P': '𝔓',
        'Q': '𝔔', 'R': 'ℜ', 'S': '𝔖', 'T': '𝔗', 'U': '𝔘', 'V': '𝔙', 'W': '𝔚', 'X': '𝔛',
        'Y': '𝔜', 'Z': 'ℨ',
        // Regular numbers (no Fraktur numbers in Unicode)
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
        '8': '8', '9': '9'
    };
    
    return text.split('').map(char => charMap[char] || char).join('');
}