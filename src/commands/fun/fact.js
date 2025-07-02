import { Command } from '../base.js';

export default new Command({
    name: 'fact',
    aliases: ['randomfact', 'didyouknow'],
    description: 'Random Aussie facts',
    usage: '!fact',
    category: 'fun',
    cooldown: 30000,
    
    async handler(bot, message, args) {
        const facts = [
            // Animal facts
            'did ya know a wombat\'s shit is cube shaped? fuckin mental',
            'kangaroos can\'t walk backwards, that\'s why they\'re on our coat of arms',
            'a group of kangaroos is called a mob, just like me mates',
            'koalas sleep 20 hours a day, living the dream those cunts',
            'platypuses are venomous, got poison spurs on their back legs',
            'emus can run at 50km/h, fast enough to outrun the army in 1932',
            'male platypuses don\'t have nipples, they sweat milk instead',
            'wombats have backwards facing pouches so dirt don\'t get in when they dig',
            'koalas have fingerprints almost identical to humans, dodgy little buggers',
            'cassowaries can disembowel ya with one kick, angry bastards',
            
            // Australian history/culture facts
            'we had a prime minister who went for a swim and never came back',
            'australia is the only country that eats its national animals',
            'we invented the word selfie, you\'re welcome world',
            'canberra exists because sydney and melbourne couldn\'t stop fighting',
            'australia has the world\'s longest golf course - 1,365 kilometers',
            'we have a town called Tittybong in Victoria, I shit you not',
            'the australian alps get more snow than switzerland',
            'we lost a war against emus in 1932, still not over it',
            'australia is wider than the moon, fuckin huge mate',
            'wifi was invented in australia, so was the black box flight recorder',
            
            // Food/drink facts
            'we eat 260 million meat pies a year, that\'s dedication',
            'fairy bread is just butter and hundreds & thousands but it\'s a national treasure',
            'bunnings snags raise millions for charity every year',
            'australia has the world\'s longest straight road - 146km of fuck all',
            'vegemite was invented from leftover brewery yeast, recycling at its finest',
            'tim tams were named after a winning racehorse',
            'lamingtons were named after some governor bloke',
            'australia consumes more meat per capita than any other country',
            
            // Geography facts
            'australia has over 10,000 beaches, you could visit a new one every day for 27 years',
            '90% of australians live on the coast, the middle\'s too fuckin hot',
            'australia moves 7cm north every year, slowly invading asia',
            'we have the world\'s largest sand island - fraser island',
            'lake hillier is bright pink and nobody knows why for sure',
            'australia is the only continent without an active volcano',
            'the great barrier reef is the largest living structure on earth',
            'australia has 3 times more sheep than people',
            
            // Weird laws and records
            'it\'s illegal to walk on the right side of a footpath in some places',
            'in victoria it\'s illegal to wear pink pants after midday on sunday',
            'australia has the world\'s largest cattle station, bigger than israel',
            'we have a 5,614km long fence to keep dingoes out',
            'melbourne has the largest greek population outside of greece',
            'the box jellyfish has killed more people than sharks, crocs and snakes combined',
            
            // Language facts
            'australians invented the word "mate" meaning friend in the 1800s',
            'we shorten everything - arvo, servo, bottlo, it\'s called efficiency',
            'saying "yeah nah" and "nah yeah" mean completely different things',
            '"chuck a sickie" is a legitimate cultural practice',
            
            // Modern facts
            'australia has the highest gambling rate in the world, love a punt',
            'we have more species of venomous snakes than any other country',
            'cane toads were introduced to eat beetles but now they\'re everywhere',
            'drop bears aren\'t real but we tell tourists they are',
            'australia has been in eurovision since 2015, still confused about that one'
        ];
        
        const fact = facts[Math.floor(Math.random() * facts.length)];
        bot.sendMessage(message.roomId, fact);
        
        return { success: true };
    }
});