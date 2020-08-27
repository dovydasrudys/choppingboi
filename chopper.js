const Jimp = require('jimp');
const fs = require('fs');
const reactionOptions = require('./reactionOptions').reactionOptions;

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

    if(fs.existsSync(`static/${name}_${nameEnd}.png`)){
        return `/${name}_${nameEnd}.png`;
    }

    return Jimp.read(url)
        .then(image => {
            //Resizing
            const targetAR = calculateAspectRatio(targetWidth + gap, targetHeight);
            const currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

            if (currentAR > targetAR) {
                image.resize(Jimp.AUTO, targetHeight);
            }
            else {
                image.resize(targetWidth + gap, Jimp.AUTO);
            }

            //Cutting
            const centerX = image.bitmap.width / 2;
            const centerY = image.bitmap.height / 2;

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


            const left = image.clone().crop(0, 0, targetWidth / 2, targetHeight);

            const right = image.clone().crop(targetWidth / 2 + gap, 0, targetWidth / 2, targetHeight);

            var wallpaper = new Jimp(targetWidth, targetHeight, '#ffffff');
            wallpaper.composite(left, 0, 0);
            wallpaper.composite(right, targetWidth / 2, 0);

            
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
        const targetAR = calculateAspectRatio(targetWidth + gap, targetHeight);
        const currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

        if (currentAR > targetAR) {
            return [reactionOptions['heart'], reactionOptions['left'], reactionOptions['right']];
        }
        else {
            return [reactionOptions['heart'], reactionOptions['up'], reactionOptions['down']];
        }
    })
}

exports.chop = chop;
exports.getPossibleCutReactions = getPossibleCutReactions;