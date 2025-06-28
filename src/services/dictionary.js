import https from 'https';

export async function getDefinition(word) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.urbandictionary.com',
            path: `/v0/define?term=${encodeURIComponent(word)}`,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };
        
        https.get(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.list && json.list.length > 0) {
                        // Get the top definition
                        const def = json.list[0];
                        const definition = def.definition.replace(/[\[\]]/g, '').replace(/[\r\n]+/g, ' ').substring(0, 200);
                        
                        // Add personality comments for certain words
                        const commentary = {
                            'bogan': 'that\'s me mate!',
                            'durry': 'can\'t live without \'em',
                            'cone': 'my favorite pastime',
                            'dole': 'been on it for years mate',
                            'vb': 'nectar of the gods',
                            'bong': 'essential household item',
                            'centrelink': 'my main income source',
                            'servo': 'where I get me durries',
                            'bottleo': 'second home after the servo',
                            'maccas': 'gourmet dining',
                            'ute': 'every bogan\'s dream car',
                            'mullet': 'peak fashion mate',
                            'thongs': 'formal footwear',
                            'goon': 'fine wine for the sophisticated',
                            'dart': 'breakfast of champions',
                            'ciggie': 'life\'s little pleasures',
                            'smoko': 'most important part of the day',
                            'bunnings': 'hardware store and restaurant',
                            'woolies': 'where shazza does the shopping',
                            'tradie': 'hardest working cunts in straya',
                            'footy': 'religion round here',
                            'pokies': 'where me centrelink goes',
                            'tinnie': 'liquid happiness',
                            'stubby': 'proper beer size',
                            'esky': 'most important camping equipment',
                            'barbie': 'aussie fine dining',
                            'snag': 'bunnings delicacy',
                            'chook': 'sunday roast material',
                            'drongo': 'everyone but me',
                            'galah': 'noisy bastards',
                            'drop bear': 'deadliest aussie animal',
                            'shazza': 'me missus, love of me life',
                            'dazza': 'that\'s me, the legend himself'
                        };
                        
                        const lowerWord = word.toLowerCase();
                        const comment = commentary[lowerWord];
                        
                        if (comment) {
                            resolve({ definition, comment });
                        } else {
                            // Random generic comments
                            const genericComments = [
                                'yeah nah, sounds about right',
                                'fuckin\' oath mate',
                                'that\'s cooked',
                                'never heard it called that',
                                'the young cunts and their slang',
                                'shazza uses that word',
                                'heard that down the pub',
                                'sounds like city talk to me'
                            ];
                            const randomComment = genericComments[Math.floor(Math.random() * genericComments.length)];
                            resolve({ definition, comment: randomComment });
                        }
                    } else {
                        reject(new Error('No definition found'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}