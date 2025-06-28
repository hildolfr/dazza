import https from 'https';

export async function getWeather(location) {
    return new Promise((resolve, reject) => {
        // Get more detailed format with humidity and wind
        const url = `https://wttr.in/${encodeURIComponent(location)}?format=%C+%t+%h+%w&m`;
        
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const trimmedData = data.trim();
                    
                    if (trimmedData.includes('Unknown location')) {
                        reject(new Error('Unknown location'));
                        return;
                    }
                    
                    // Parse weather data
                    const tempMatch = trimmedData.match(/([+-]?\d+°C)/);
                    const temp = tempMatch ? tempMatch[1] : '';
                    
                    // Extract condition (everything before temperature)
                    const conditionEnd = tempMatch ? trimmedData.indexOf(tempMatch[1]) : trimmedData.length;
                    const condition = trimmedData.substring(0, conditionEnd).trim();
                    
                    // Weather comments based on conditions
                    const weatherComments = {
                        'Clear': 'perfect weather for a barbie',
                        'Sunny': 'hot as balls, time for a cold one',
                        'Partly cloudy': 'not bad, could still chuck a sickie',
                        'Cloudy': 'bit cloudy, still good for a cone',
                        'Overcast': 'gloomy as, might stay in for a sesh',
                        'Mist': 'can\'t see shit through this mist',
                        'Patchy rain possible': 'might piss down, better pack the bong inside',
                        'Patchy snow possible': 'fuckin\' freezing, might see some snow',
                        'Patchy sleet possible': 'sleet? what the fuck is sleet?',
                        'Patchy freezing drizzle possible': 'freezing drizzle, sounds fucked',
                        'Thundery outbreaks possible': 'thunder! sick light show incoming',
                        'Blowing snow': 'snow blowin\' everywhere, stay inside mate',
                        'Blizzard': 'fuckin\' blizzard! end times mate',
                        'Fog': 'foggy as, can\'t see me hand in front of me face',
                        'Freezing fog': 'freezing fog, that\'s cooked',
                        'Patchy light drizzle': 'bit of drizzle never hurt anyone',
                        'Light drizzle': 'pissin\' down lightly',
                        'Freezing drizzle': 'freezing rain, roads are fucked',
                        'Heavy freezing drizzle': 'heavy freezing rain, definitely staying in',
                        'Patchy light rain': 'bit of rain here and there',
                        'Light rain': 'light rain, she\'ll be right',
                        'Moderate rain at times': 'proper rain, get the brolly',
                        'Moderate rain': 'decent rain, good for the garden I guess',
                        'Heavy rain at times': 'bucketing down sometimes',
                        'Heavy rain': 'pissin\' down heavy, fuckin\' drenched',
                        'Light freezing rain': 'freezing rain, watch out for ice',
                        'Moderate or heavy freezing rain': 'heavy freezing rain, roads are death traps',
                        'Light sleet': 'light sleet, whatever that is',
                        'Moderate or heavy sleet': 'heavy sleet, sounds shit',
                        'Patchy light snow': 'bit of snow here and there',
                        'Light snow': 'light snow, pretty but cold as',
                        'Patchy moderate snow': 'decent snow patches',
                        'Moderate snow': 'proper snow, time for a snowball fight',
                        'Patchy heavy snow': 'heavy snow in spots',
                        'Heavy snow': 'snowing like crazy, everything\'s fucked',
                        'Ice pellets': 'ice pellets? nature\'s ammunition',
                        'Light rain shower': 'quick shower, no drama',
                        'Moderate or heavy rain shower': 'heavy shower, get inside quick',
                        'Torrential rain shower': 'torrential rain! fuck me dead',
                        'Light sleet showers': 'sleet showers, still don\'t know what sleet is',
                        'Moderate or heavy sleet showers': 'heavy sleet showers, sounds awful',
                        'Light snow showers': 'snow showers, bit romantic innit',
                        'Moderate or heavy snow showers': 'heavy snow showers, white out conditions',
                        'Light showers of ice pellets': 'ice pellet showers, ouch',
                        'Moderate or heavy showers of ice pellets': 'heavy ice pellets, stay inside unless you want bruises',
                        'Patchy light rain with thunder': 'bit of rain and thunder',
                        'Moderate or heavy rain with thunder': 'thunderstorm! fuckin\' biblical'                    };
                    
                    const comment = weatherComments[condition] || 'weather\'s alright I reckon';
                    
                    // Format message with temperature conversion if available
                    let weatherMessage = `${condition}`;
                    
                    if (temp) {
                        // Parse and convert temperature
                        const celsiusMatch = temp.match(/([+-]?\d+)/);
                        if (celsiusMatch) {
                            const celsiusValue = parseFloat(celsiusMatch[1]);
                            const fahrenheit = (celsiusValue * 9/5 + 32).toFixed(0);
                            weatherMessage += ` ${temp} (${fahrenheit}°F for the yanks)`;
                        }
                    }
                    
                    weatherMessage += `, ${comment}`;
                    resolve(weatherMessage);
                } else {
                    reject(new Error(`Weather API returned status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}