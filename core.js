const fs = require('fs');

const Discord = require('discord.js');
const axios = require('axios').default;

const chop = require('./chopper').chop;

//Set up express
const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => res.send('Hello World!'));
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
//--------------------------------------------------------

const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

let SUBREDDIT = 'https://www.reddit.com/r/WidescreenWallpaper';
let lastPost = {
    id: null
};

const reactionOptions = {
    thumbsup: '👍',
    heart: '❤️',
}

client.once('ready', () => {
    console.log('ready');
    setInterval(() => {
        console.log('trying to get post');

        getLastPost().then((post) => {
            if (post) {
                console.log('got post');
                const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
                const ids = content.split('\n');
                ids.pop();
                if(ids.length > 0){
                    chop(lastPost.url)
                    .then((wallpaperFile) => {
                      ids.forEach((id) => {
                        const channel = client.channels.cache.get(id);
                        if(channel){
                            channel.send(`[POST] ${lastPost.title} ${lastPost.url}`)
                            .then(message => {
                                for (key in reactionOptions) {
                                    message.react(reactionOptions[key]);
                                }
                            });
                        }
                      });
                    });
                }
            } else {
                console.log('no post');
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
        const url = reaction.message.content.split(' ').find(part => part.startsWith('https:'));
        chop(url)
        .then((wallpaperFile) =>{
            switch (reaction.emoji.name) {
                case reactionOptions.thumbsup:
                    user.send(`Hey, I chopped up an image you liked 😊`, {files: [wallpaperFile]});
                    break;
                case reactionOptions.heart:
                    reaction.message.channel.send(`This one is so good, everyone should try it 😍`, {files: [wallpaperFile]});
                default:
                    console.log('default');
                    break;
            }
        })
    }
})

client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop reset')) {
        lastPost.id = null;
    }
});


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

client.login('NzM2MjUxNDQ1ODY2NzkxMDEy.XxsFlw.Tf_a7PXGCWpi-1Tk4YnKW7hqSc4');