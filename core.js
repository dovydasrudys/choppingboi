import 'dotenv/config.js';

import fs from 'fs';

import Discord from 'discord.js';
import axios from 'axios';

import { chop, getPossibleCutReactions } from './chopper.js';
import { reactionOptions } from './reactionOptions.js';

//Set up express
import express from 'express';
const app = express();

app.get('/', (req, res) => res.send('Hello World!'));
app.listen(process.env.PORT, () => console.log(`Listening on port: ${process.env.PORT}`));
app.use(express.static('static'))
//--------------------------------------------------------

let lastPost = {
    id: null
};

lastPost.id = fs.readFileSync('last_post.txt', { encoding: 'utf-8', flag: 'r' });

const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });

let SUBREDDIT = 'https://www.reddit.com/r/WidescreenWallpaper';

client.once('ready', () => {
    logLine('-------------------Started-------------------');
    logLine(`Last post is ${lastPost.id}`);
    checkSubreddit();
    setInterval(checkSubreddit, process.env.MINUTES_BETWEEN_CHECKS * 60 * 1000);
});

client.on('messageReactionAdd', (reaction, user) => {
    handleMessageReaction(reaction, user);
});

client.on('message', (message) => {
    if (message.content.toLowerCase().startsWith('!chop register')) {
        registerChannel(message);
    } else if (message.content.toLowerCase() === '!chop filters show') {
        showFilters(message);
    } else if (message.content.toLowerCase().startsWith('!chop filters add')) {
        addFilter(message);
    } else if (message.content.toLowerCase().startsWith('!chop filters remove')) {
        removeFilter();
    } else if (message.content.toLowerCase().startsWith('!chop')) {
        addChopRequest(message);
    }
});

function logLine(line) {
    let datetime = new Date();
    datetime.setHours(datetime.getHours() + 3);
    fs.appendFileSync('log.txt', `${datetime.toLocaleString()}: ${line}\n`);
}

function showFilters(message) {
    const filtersContent = fs.readFileSync('filters.txt', { encoding: 'utf8', flag: 'r' }).trim();
    if (filtersContent === '') {
        return;
    }
    const filters = filtersContent.split('\n');
    let filtersMessage = '';
    for (let index = 0; index < filters.length; index++) {
        filtersMessage += `[${index + 1}] ${filters[index]}\n`;
    }
    message.channel.send(filtersMessage);
}

function addFilter(message) {
    const newFilter = message.content.toLowerCase().replace('!chop filters add ', '');
    fs.appendFile('filters.txt', `${newFilter}\n`, () => {
        message.channel.send(`"${newFilter}" added to filters list.`);
    });
}

async function removeFilter(message) {
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

function registerChannel(message) {
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

function addChopRequest(message) {
    const args = message.content.toLowerCase().split(' ');

    let url = '';
    let title = '';

    if (args.length === 1 && message.attachments.size === 1) {   //attached file
        const attachement = message.attachments.values().next().value;
        url = attachement.url;
        title = attachement.name;
    } else if (args.length === 3) {                               //provided url
        url = args[1];
        title = args[2].replace(/[^a-zA-Z0-9]/g, '_');
    } else {
        message.channel.send('You might want to try !chop and attach a file to the message or !chop https://urlOfAnImageToChop TitleForTheImage');
        return;
    }

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

async function handleMessageReaction(reaction, user) {
    console.log('handling');
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.log('Something went wrong when fetching the message: ', error);
            return;
        }
    }

    if (user.id === client.user.id) {
        console.log(user.id, client.user.id);
        return;
    }

    if (reaction.message.author.id === client.user.id && reaction.message.embeds.length > 0) {
        console.log(reaction.message.author.id, client.user.id);
        //If not one of the possible reaction options then do nothing
        if (!Object.values(reactionOptions).includes(reaction.emoji.name)) {
            return;
        }

        logLine('Handling message reaction');

        const url = reaction.message.embeds[0].fields.find((field) => field.name === 'Original image url').value;
        const title = reaction.message.embeds[0].fields.find((field) => field.name === 'Image title').value;
        let redditURL = reaction.message.embeds[0].fields.find((field) => field.name === 'Reddit post');
        if (redditURL) {
            redditURL = redditURL.value;
        }

        //Remove all other user reactions
        if (reaction.message.channel.type !== "dm") {
            for (const key in reactionOptions) {
                const option = reactionOptions[key];
                if (option !== reaction.emoji.name) {
                    const reactionObject = reaction.message.reactions.resolve(option);
                    if (reactionObject) {
                        reactionObject.users.remove(user);
                    }
                }
            }
        }

        const result = chop(url, title, reaction.emoji.name);
        Promise.resolve(result)
            .then((path) => {
                const embed = new Discord.MessageEmbed()
                    .setTitle(`Hey, I chopped up an image you liked 😊`)
                    .setURL(`${process.env.HOSTNAME}${path}`)
                    .setImage(`${process.env.HOSTNAME}${path}`)
                    .addField('Image title', title)
                    .addField('Original image url', url);
                if (redditURL) {
                    embed.addField('Reddit post', redditURL);
                }

                user.send(embed)
                    .then((message) => {
                        if (reaction.message.embeds[0].title.startsWith('Hey')) {
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
    logLine('Message reaction handled successfully');
}

function checkSubreddit() {
    logLine('Checking SUBREDDIT');
    getLastPost().then(post => {
        if (post) {
            logLine(`New post was found (${post.id}). Last post was (${lastPost.id}).`);
            lastPost = post;
            fs.writeFileSync('last_post.txt', post.id);
            getPossibleCutReactions(post.url).then(possibleReactions => {
                const content = fs.readFileSync('channels.txt', { encoding: 'utf8', flag: 'r' });
                const ids = content.split('\n');
                ids.pop();
                if (ids.length > 0) {
                    const embed = new Discord.MessageEmbed()
                        .setTitle(`${post.title}`)
                        .setImage(`${post.url}`)
                        .addField('Image title', `${post.title.replace(/[^a-zA-Z0-9]/g, '_')}`)
                        .addField('Original image url', post.url)
                        .addField('Reddit post', `${SUBREDDIT}/comments/${post.id}`);

                    let datetime = new Date();
                    datetime.setHours(datetime.getHours() + 3);
                    fs.appendFileSync('posts.txt', `${datetime.toLocaleString()}: ${post.id}\n`);

                    ids.forEach((id) => {
                        const channel = client.channels.cache.get(id);
                        if (channel) {
                            channel.send(embed)
                                .then(message => {
                                    possibleReactions.forEach((option) => {
                                        message.react(option);
                                    });
                                });
                        }
                    });
                }
            })

        } else {
            logLine('There are no new posts.');
        }
    }).catch(reason => {
        logLine(`Catch block: ${reason}`);
    });
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
                            if (post.title.toLowerCase().includes(filter)) {
                                return null;
                            }
                        });

                        return post;
                    } else {
                        return null;
                    }
                } else {
                    return null;
                }
            } else {
                return null;
            }
        })
        .catch(reason => {
            console.log(reason);
            return null;
        });
}

client.login(process.env.DISCORD_TOKEN);