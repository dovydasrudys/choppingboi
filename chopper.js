const Jimp = require('jimp');

var targetWidth = 3840;
var targetHeight = 1200;
var gap = 40;

function calculateAspectRatio(width, height) {
    return width / height;
}

function chop(url) {
    return Jimp.read(url)
        .then(image => {
            const targetAR = calculateAspectRatio(targetWidth + gap, targetHeight);
            const currentAR = calculateAspectRatio(image.bitmap.width, image.bitmap.height);

            if (currentAR > targetAR) {
                image.resize(Jimp.AUTO, targetHeight, Jimp.RESIZE_BILINEAR);
                const centerX = image.bitmap.width / 2 - 1;
                image.crop(centerX - ((targetWidth + gap) / 2), 0, targetWidth + gap, targetHeight);
            } else if (currentAR < targetAR) {
                image.resize(targetWidth + gap, Jimp.AUTO, Jimp.RESIZE_BILINEAR);
                const centerY = image.bitmap.height / 2 - 1;
                image.crop(0, centerY - (targetHeight / 2), targetWidth + gap, targetHeight);
            }
            else {
                image.resize(targetWidth + gap, Jimp.AUTO, Jimp.RESIZE_BILINEAR);
            }

            const left = image.clone().crop(0, 0, targetWidth / 2, targetHeight);

            const right = image.clone().crop(targetWidth / 2 + gap, 0, targetWidth / 2, targetHeight);

            var wallpaper = new Jimp(targetWidth, targetHeight, '#ffffff');
            wallpaper.composite(left, 0, 0);
            wallpaper.composite(right, targetWidth / 2, 0);

            const wallpaperFile = 'wallpaper.png';
            image.write(wallpaperFile);

            return wallpaperFile;
        })
        .catch(err => {
            console.log(err);
        });
}

exports.chop = chop;