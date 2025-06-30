import { WordCountAnalyzer } from './WordCountAnalyzer.js';

// Mock logger for testing
const mockLogger = {
    info: () => {},
    error: () => {},
    debug: () => {}
};

// Create analyzer instance for testing
const analyzer = new WordCountAnalyzer(null, mockLogger);

// Test cases
const testCases = [
    // Basic cases
    { message: 'Hello world', expected: 2, description: 'Simple two-word message' },
    { message: 'The quick brown fox jumps over the lazy dog', expected: 9, description: 'Regular sentence' },
    { message: '', expected: 0, description: 'Empty message' },
    { message: '   ', expected: 0, description: 'Only whitespace' },
    { message: null, expected: 0, description: 'Null message' },
    { message: undefined, expected: 0, description: 'Undefined message' },
    
    // Contractions
    { message: "Don't count this as four words", expected: 6, description: 'Contractions count as single words' },
    { message: "It's what's happening that's important", expected: 5, description: 'Multiple contractions' },
    
    // URLs
    { message: 'Check out https://example.com for more info', expected: 6, description: 'URL counts as 1 word' },
    { message: 'https://example.com https://test.com two urls here', expected: 6, description: 'Multiple URLs' },
    { message: 'Visit www.example.com today', expected: 3, description: 'www URL format' },
    
    // Mentions
    { message: 'Hey @dazza how are you?', expected: 5, description: '@mention counts as 1 word' },
    { message: '@user1 @user2 @user3 meeting now', expected: 6, description: 'Multiple mentions' },
    { message: '@hyphen-user @under_score check this', expected: 5, description: 'Mentions with special chars' },
    
    // Emojis
    { message: 'Hello 😊 world 🌍!', expected: 2, description: 'Emojis don\'t count as words' },
    { message: '😀😃😄😁😆', expected: 0, description: 'Only emojis' },
    { message: 'Great job! 👍👏🎉', expected: 2, description: 'Words with emojis' },
    
    // Special characters
    { message: 'Hello!!! World???', expected: 2, description: 'Punctuation doesn\'t count' },
    { message: 'test@email.com is an email', expected: 5, description: 'Email addresses' },
    { message: '$$$ ### %%% &&&', expected: 0, description: 'Only special characters' },
    
    // Numbers
    { message: 'I have 123 apples and 456 oranges', expected: 6, description: 'Numbers count as words' },
    { message: '42', expected: 1, description: 'Just a number' },
    { message: 'Call 555-1234 for info', expected: 4, description: 'Phone numbers' },
    
    // Mixed cases
    { message: 'Hey @dazza check https://example.com/page 😊 it\'s awesome!', expected: 7, description: 'Complex message with all elements' },
    { message: '@user1 @user2 https://link1.com https://link2.com meeting at 3pm 📅', expected: 8, description: 'Multiple mentions and URLs' },
    
    // Edge cases
    { message: 'word1word2word3', expected: 1, description: 'No spaces between words' },
    { message: 'UPPERCASE lowercase MiXeD', expected: 3, description: 'Case variations' },
    { message: 'one-two-three', expected: 1, description: 'Hyphenated words without spaces' },
    { message: 'one - two - three', expected: 3, description: 'Hyphenated with spaces' },
    
    // Very long messages
    { message: 'word '.repeat(1000).trim(), expected: 1000, description: 'Very long message (1000 words)' },
    { message: '@user '.repeat(100) + 'https://example.com '.repeat(100) + 'word '.repeat(100), expected: 300, description: 'Long mixed content' }
];

console.log('Word Count Analyzer Test Results\n' + '='.repeat(80));

let passed = 0;
let failed = 0;

for (const test of testCases) {
    const result = analyzer.countWords(test.message);
    const status = result === test.expected ? '✓ PASS' : '✗ FAIL';
    
    if (result === test.expected) {
        passed++;
    } else {
        failed++;
        console.log(`\n${status}: ${test.description}`);
        console.log(`  Message: "${test.message}"`);
        console.log(`  Expected: ${test.expected}, Got: ${result}`);
        
        // Show detailed breakdown for failed tests
        if (test.message) {
            const details = analyzer.testWordCount(test.message);
            console.log(`  Breakdown: URLs=${details.urls}, Mentions=${details.mentions}, Regular words=${details.regularWords}`);
        }
    }
}

console.log('\n' + '='.repeat(80));
console.log(`Summary: ${passed} passed, ${failed} failed`);

// Performance test
console.log('\n' + '='.repeat(80));
console.log('Performance Test:');

const longMessage = 'This is a test message with @user and https://example.com '.repeat(100);
const iterations = 10000;

console.time('Performance');
for (let i = 0; i < iterations; i++) {
    analyzer.countWords(longMessage);
}
console.timeEnd('Performance');

const wordsPerMessage = analyzer.countWords(longMessage);
console.log(`Processed ${iterations} messages with ${wordsPerMessage} words each`);
console.log(`Total words processed: ${(iterations * wordsPerMessage).toLocaleString()}`);