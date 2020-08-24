// const express = require('express');
// const app = express();
// const port = 3000;

// app.get('/', (req, res) => res.send('Hello World!'));

// app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));

const fs = require('fs');

const Discord = require('discord.js');
const axios = require('axios').default;
const client = new Discord.Client();

let SUBREDDIT = 'https://www.reddit.com/r/WidescreenWallpaper';
let lastPost = {
    id: null
};

client.once('ready', () => {
    console.log('ready');
    setInterval(() => {
        console.log('trying to get post');

        getLastPost().then((post) => {
            console.log(post);
            if(post){
                console.log('got post');
                const content = fs.readFileSync('channels.txt', {encoding:'utf8', flag:'r'});
                const ids = content.split('\n');
                ids.pop();
                ids.forEach((id) => {
                    const channel = client.channels.cache.get(id);
                    if(channel){
                        channel.send(`${lastPost.title} ${lastPost.url}`);
                        chop(lastPost.url).then((wallpaperFile) => {
                            channel.send('Chopped image:', {files:[wallpaperFile]});
                        })
                    }
                });
            } else {
                console.log('no post');
            }
        })
    }, 10 * 1000)
});

client.on('message', (message) => {
    if(message.content.toLowerCase().startsWith('!chop')){
        const content = fs.readFileSync('channels.txt', {encoding:'utf8', flag:'r'});
        const ids = content.split('\n');
        if(!ids.includes(message.channel.id)){
            fs.appendFile('channels.txt', `${message.channel.id}\n`, function (err) {
                if (err) console.log(err);
                console.log(`${message.channel.id} added to channels list`);
            });
        }
    }
})

function getLastPost(){
    return axios.get(`${SUBREDDIT}/new.json?limit=1`)
        .then(response => {
            if(response.status === 200){
                if(response.data.data.children.length > 0){
                    const post = response.data.data.children[0].data;
                    if(post && post.id !== lastPost.id){
                        lastPost = post;
                        return post;
                    }
                }
            }
        });
}

const Jimp = require('jimp');

var targetWidth = 3840;
var targetHeight = 1200;
var gap = 40;

calculateAspectRatio = (width, height) => {
  return width/height;
}

function chop(url) {
    return Jimp.read(url)
    .then(image => {
      const targetAR = calculateAspectRatio(targetWidth + gap, targetHeight);
      const currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

      if(currentAR > targetAR){
        image.resize(Jimp.AUTO, targetHeight, Jimp.RESIZE_BILINEAR);
        const centerX = image.bitmap.width / 2 - 1;
        image.crop(centerX - ((targetWidth + gap) / 2), 0, targetWidth + gap, targetHeight);
      }else if(currentAR < targetAR){
        image.resize(targetWidth + gap, Jimp.AUTO, Jimp.RESIZE_BILINEAR);
        const centerY = image.bitmap.height / 2 - 1;
        image.crop(0, centerY - (targetHeight / 2), targetWidth + gap, targetHeight);
      }
      else {
        image.resize(targetWidth + gap, Jimp.AUTO, Jimp.RESIZE_BILINEAR);
      }

      const left = image.clone().crop(0, 0, targetWidth/2, targetHeight);

      const right = image.clone().crop(targetWidth/2 + gap, 0, targetWidth / 2, targetHeight);

      var wallpaper = new Jimp(targetWidth, targetHeight, '#ffffff');
      wallpaper.composite(left, 0, 0);
      wallpaper.composite(right, targetWidth/2, 0);

      const wallpaperFile = 'wallpaper.png';
      image.write(wallpaperFile);

      return wallpaperFile;
    })
    .catch(err => {
      console.log(err);
    });
}

client.login('NzM2MjUxNDQ1ODY2NzkxMDEy.XxsFlw.A_rBHMUCi75JffWYRdaK6Tou38I');