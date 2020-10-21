import Jimp from 'jimp';
import fs from 'fs';
import {reactionOptions} from './reactionOptions.js';

var targetWidth = 3840;
var targetHeight = 1200;
var gap = 40;

function calculateAspectRatio(width, height) {
    return width / height;
}

function chop(url, name, cutOption) {
    let nameEnd = '';
    for (const key in reactionOptions) {
        if(reactionOptions[key] === cutOption){
            nameEnd = key;
        }
    }
    console.log(`chopping ${name}${nameEnd}`);

    if(fs.existsSync(`static/${name}_${nameEnd}.png`)){
        return `/${name}_${nameEnd}.png`;
    }

    return Jimp.read(url)
        .then(image => {
            //Resizing
            let targetAR = calculateAspectRatio(targetWidth + gap, targetHeight);
            let currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

            if (currentAR > targetAR) {
                image.resize(Jimp.AUTO, targetHeight);
            }
            else {
                image.resize(targetWidth + gap, Jimp.AUTO);
            }

            console.log(`resized ${name}${nameEnd}`);

            //Cutting
            let centerX = image.bitmap.width / 2;
            let centerY = image.bitmap.height / 2;

            switch (cutOption) {
                case reactionOptions.heart:
                    image.crop(centerX - ((targetWidth + gap) / 2), centerY - (targetHeight / 2), targetWidth + gap, targetHeight);
                    break;
                case reactionOptions.left:
                    image.crop(0, centerY - (targetHeight / 2), targetWidth + gap, targetHeight);
                    break;
                case reactionOptions.right:
                    image.crop(image.bitmap.width - (targetWidth + gap + 1), centerY - (targetHeight / 2), targetWidth + gap, targetHeight);
                    break;
                case reactionOptions.up:
                    image.crop(centerX - ((targetWidth + gap) / 2), 0, targetWidth + gap, targetHeight);
                    break;
                case reactionOptions.down:
                    image.crop(centerX - ((targetWidth + gap) / 2), image.bitmap.height - (targetHeight + 1), targetWidth + gap, targetHeight);
                    break;
                default:
                    break;
            }

            console.log(`cropped ${name}${nameEnd}`);


            let left = image.clone().crop(0, 0, targetWidth / 2, targetHeight);

            let right = image.clone().crop(targetWidth / 2 + gap, 0, targetWidth / 2, targetHeight);

            let wallpaper = new Jimp(targetWidth, targetHeight, '#ffffff');
            wallpaper.composite(left, 0, 0);
            wallpaper.composite(right, targetWidth / 2, 0);

            console.log(`composed ${name}${nameEnd}`);
            
            wallpaper.write(`static/${name}_${nameEnd}.png`);

            return `/${name}_${nameEnd}.png`
        })
        .catch(err => {
            console.log(err);
        });
}

function getPossibleCutReactions(url){
    return Jimp.read(url)
    .then(image => {
        let targetAR = calculateAspectRatio(targetWidth, targetHeight);
        let currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

        if (currentAR > targetAR) {
            return [reactionOptions['heart'], reactionOptions['left'], reactionOptions['right']];
        }
        else if(currentAR < targetAR) {
            return [reactionOptions['heart'], reactionOptions['up'], reactionOptions['down']];
        }
        return [reactionOptions['heart']];
    })
}

export {chop, getPossibleCutReactions};