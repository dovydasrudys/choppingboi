require('dotenv').config();

const fs = require('fs');

const Discord = require('discord.js');
const axios = require('axios').default;

const chop = require('./chopper').chop;
const getPossibleCutReactions = require('./chopper').getPossibleCutReactions;
const reactionOptions = require('./reactionOptions').reactionOptions;

//Set up express
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => res.send('Hello World!'));
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
app.use(express.static('static'))
//--------------------------------------------------------


const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

let SUBREDDIT = 'https://www.reddit.com/r/WidescreenWallpaper';

let lastPost = {
    id: null
};

client.once('ready', () => {
    console.log('ready');
    lastPost.id = fs.readFileSync('last_post.txt', { encoding: 'utf-8', flag: 'r'});
    checkSubreddit();
    setInterval(checkSubreddit, 5 * 60 * 1000);
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.log('Something went wrong when fetching the message: ', error);
			return;
		}
    }

    if(user.id === client.user.id){
        return;
    }
    
    if(reaction.message.author.id === client.user.id && reaction.message.embeds.length > 0){
        //If not one of the possible reaction options then do nothing
        if(!Object.values(reactionOptions).includes(reaction.emoji.name)){
            return;
        }

        const url = reaction.message.embeds[0].fields.find((field) => field.name === 'Original image url').value;
        const title = reaction.message.embeds[0].fields.find((field) => field.name === 'Image title').value;

        //Remove all other user reactions
        if(reaction.message.channel.type !== "dm"){
            for (const key in reactionOptions) {
                const option = reactionOptions[key];
                if(option !== reaction.emoji.name){
                    const reactionObject = reaction.message.reactions.resolve(option);
                    if(reactionObject){
                        reactionObject.users.remove(user);
                    }
                }
            }
        }

        const result = chop(url, title, reaction.emoji.name);
        Promise.resolve(result)
        .then((path) =>{
            console.log(path);

            console.log(`${process.env.REPL}${path}`);

            const embed = new Discord.MessageEmbed()
                .setTitle(`Hey, I chopped up an image you liked 😊`)
                .setURL(`${process.env.REPL}${path}`)
                .setImage(`${process.env.REPL}${path}`)
                .addField('Image title', title)
                .addField('Original image url', url);

            user.send(embed)
                .then((message) => {
                    if (reaction.message.embeds[0].title.startsWith('Hey')){
                        reaction.message.delete();
                    }

                    getPossibleCutReactions(url).then((possibleReactions) => {
                        possibleReactions.forEach((option) => {
                            message.react(option);
                        });
                    });
                });
        });
    }
})


client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop')) {
        const args = message.content.toLowerCase().split(' ');

        if (args.length === 2 && args[1] === 'register'){
            const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
            const ids = content.split('\n');
            if (!ids.includes(message.channel.id)) {
                fs.appendFile('channels.txt', `${message.channel.id}\n`, function (err) {
                    if (err) console.log(err);
                    console.log(`${message.channel.id} added to channels list`);
                    message.channel.send('I added this channel to my list 😊');
                });
            } else {
                message.channel.send('This channel was already in my list 😊');
            }
        }
        message.delete();
    }
});

client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop')) {
        const args = message.content.toLowerCase().split(' ');

        if(args[1] === 'filters'){
            return;
        }

        if (args.length === 3){
            const url = args[1];
            const title = args[2].replace(/[^a-zA-Z0-9]/g,'_');

            const embed = new Discord.MessageEmbed()
                .setTitle(`${message.author.username}'s request 😊`)
                .setImage(url)
                .addField('Image title', title)
                .addField('Original image url', url);

            message.channel.send(embed)
                .then((message) => {
                    getPossibleCutReactions(url).then((possibleReactions) => {
                        possibleReactions.forEach((option) => {
                            message.react(option);
                        });
                    });
                });
        }
        message.delete();
    }
});

client.on('message', (message) => {
    if (message.content.toLowerCase() === '!chop filters show'){
        const filtersContent = fs.readFileSync('filters.txt', { encoding: 'utf8', flag: 'r' }).trim();
        if (filtersContent === ''){
            return;
        }
        const filters = filtersContent.split('\n');
        let filtersMessage = '';
        for (let index = 0; index < filters.length; index++) {
            filtersMessage += `[${index + 1}] ${filters[index]}\n`;
        }
        message.channel.send(filtersMessage);
    }
});

client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop filters add')){
        const newFilter = message.content.toLowerCase().replace('!chop filters add ', '');
        fs.appendFile('filters.txt', `${newFilter}\n`, () => {
            message.channel.send(`"${newFilter}" added to filters list.`);
        });
    }
});

client.on('message', async (message) => {
    if (message.content.toLowerCase().startsWith('!chop filters remove')){
        const filterToDeleteNr = parseInt(message.content.toLowerCase().replace('!chop filters remove ', ''));
        const filtersContent = fs.readFileSync('filters.txt', { encoding: 'utf8', flag: 'r' }).trim();
        const updatedFilters = filtersContent.split('\n').filter((value, index) => index !== filterToDeleteNr - 1);
        await fs.writeFile('filters.txt', '', () => {
            console.log('filters file cleaned');
        });
        for (let index = 0; index < updatedFilters.length; index++) {
            fs.appendFile('filters.txt', `${updatedFilters[index]}\n`, () => {
                message.channel.send(`Filter No.${filterToDeleteNr} deleted from filters list.`);
            });
        }
    }
});

async function checkSubreddit(){
    const post = await getLastPost();
    if (post) {
        lastPost.id = post.id;
        fs.writeFile('last_post.txt', post.id, () => {console.log('Last post changed.')});
        const possibleReactions = await getPossibleCutReactions(post.url);
        // const name = post.url.replace('https://i.redd.it/','').split('.')[0];
        // await chop(post.url, name, possibleReactions[0]);
        // await chop(post.url, name, possibleReactions[1]);
        // await chop(post.url, name, possibleReactions[2]);
        const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
        const ids = content.split('\n');
        ids.pop();
        ids.forEach((id) => {
            const channel = client.channels.cache.get(id);
            if(channel){
                const embed = new Discord.MessageEmbed()
                    .setTitle(`${post.title}`)
                    .setImage(`${post.url}`)
                    .addField('Image title', `${post.title.replace(/[^a-zA-Z0-9]/g,'_')}`)
                    .addField('Original image url', post.url);

                channel.send(embed)
                .then(message => {
                    possibleReactions.forEach((option) => {
                        message.react(option);
                    });
                });
            }
        });
    }
}

function getLastPost() {
    return axios.get(`${SUBREDDIT}/new.json?limit=1`)
        .then(response => {
            if (response.status === 200) {
                if (response.data.data.children.length > 0) {
                    const post = response.data.data.children[0].data;
                    if (post && post.id !== lastPost.id) {
                        const filtersContent = fs.readFileSync('filters.txt', { encoding: 'utf8', flag: 'r' }).trim();
                        const filters = filtersContent.split('\n');
                        filters.forEach((filter) => {
                            if(post.title.toLowerCase().includes(filter)){
                                return null;
                            }
                        });

                        lastPost = post;
                        return post;
                    } else {
                        return null;
                    }
                }
            }
        });
}

client.login(process.env.DISCORD_TOKEN);