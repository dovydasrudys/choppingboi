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

lastPost.id = fs.readFileSync('last_post.txt', { encoding: 'utf-8', flag: 'r'});

client.once('ready', () => {
    console.log('ready');
    setInterval(() => {

        getLastPost().then((post) => {
            if (post) {
                lastPost.id = post.id;
                fs.writeFile('last_post.txt', post.id, () => {console.log('Last post changed.')});

                getPossibleCutReactions(post.url).then((possibleReactions => {
                    const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
                    const ids = content.split('\n');
                    ids.pop();
                    ids.forEach((id) => {
                        const channel = client.channels.cache.get(id);
                        if(channel){
                            channel.send(`[POST] ${post.title} ${post.url}`)
                            .then(message => {
                                possibleReactions.forEach((reaction) => {
                                    message.react(reaction);
                                })
                            });
                        }
                    });
                }));
            }
        })
    }, 10 * 1000)
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
    
    if(reaction.message.author.id === client.user.id && reaction.message.content.startsWith('[POST]')){
        //If not one of the possible reaction options then do nothing
        if(!Object.values(reactionOptions).includes(reaction.emoji.name)){
            return;
        }

        //Remove all other user reactions
        for (const key in reactionOptions) {
            const option = reactionOptions[key];
            if(option !== reaction.emoji.name){
                const reactionObject = reaction.message.reactions.resolve(option);
                if(reactionObject){
                    reactionObject.users.remove(user);
                }
            }
        }

        const url = reaction.message.content.split(' ').find(part => part.startsWith('https:'));
        const name = url.replace('https://i.redd.it/','').split('.')[0];

        const result = chop(url, name, reaction.emoji.name);
        Promise.resolve(result)
        .then((path) =>{
            console.log(path);
            user.send(`Hey, I chopped up an image you liked 😊 ${process.env.REPL}/${path}`);
        });
    }
})


client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop')) {
        const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
        const ids = content.split('\n');
        if (!ids.includes(message.channel.id)) {
            fs.appendFile('channels.txt', `${message.channel.id}\n`, function (err) {
                if (err) console.log(err);
                console.log(`${message.channel.id} added to channels list`);
            });
        }
    }
})

function getLastPost() {
    return axios.get(`${SUBREDDIT}/new.json?limit=1`)
        .then(response => {
            if (response.status === 200) {
                if (response.data.data.children.length > 0) {
                    const post = response.data.data.children[0].data;
                    if (post && post.id !== lastPost.id) {
                        lastPost = post;
                        return post;
                    }
                }
            }
        });
}

client.login(process.env.DISCORD_TOKEN);