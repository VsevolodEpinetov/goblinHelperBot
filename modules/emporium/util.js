const { default: axios } = require("axios")
const FormData = require("form-data")
const { createCanvas, loadImage } = require('canvas')
const fs = require('fs');
const path = require('path');

const uploadsToken = process.env.TOKEN_UPLOADS;
const newCreatureToken = process.env.TOKEN_CREATE_CREATURE;

module.exports = {
  uploadImage: async function (ctx, imageBuffer, fileName) {
    try {
      const imgdata = new FormData();
      const buffer = Buffer.from(imageBuffer.data, 'binary');
      imgdata.append('files', buffer, { filename: fileName });
      const response = await axios.post(`https://api.stl-emporium.ru/api/upload`, imgdata, {
        headers: { 'Content-Type': 'multipart/form-data', "Authorization": `Bearer ${uploadsToken}` },
      });
      const imageId = response.data[0].id;
      return imageId;
    } catch (error) {
      console.log('Error: ' + error);
      throw error; // Propagate the error
    }
  },
  createACreature: async function (creatureData) {
    try {
      await axios.post(`https://api.stl-emporium.ru/api/creatures`, creatureData, {
        headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${newCreatureToken}` },
      })
      console.log(`Created a creature in the emporium`);
      return 'ok';
    } catch (error) {
      console.log('Error: ' + error);
      throw error; // Propagate the error
    }
  },

  placePngAndGetPic: async function (ctx, telegramFileId, pathToBaseImage = './index/human.png') {
    // Get the user's overlay image from the message
    const overlayImageFile = telegramFileId;

    // Load the base image
    const baseImage = await loadImage(pathToBaseImage);
    const overlayOffset = 50;

    // Create a canvas with the same dimensions as the base image
    const canvas = createCanvas(baseImage.width, baseImage.height);
    const canvasCtx = canvas.getContext('2d');

    // Draw the base image on the canvas
    canvasCtx.drawImage(baseImage, 0, 0);

    // Load the user's overlay image
    try {
      const overlayImageLink = await ctx.telegram.getFileLink(overlayImageFile);
      const response = await axios.get(overlayImageLink.href, { responseType: 'arraybuffer' })
      const overlayImageBuffer = Buffer.from(response.data, "utf-8")

      const overlayImage = await loadImage(overlayImageBuffer);

      // Calculate the new dimensions for the overlay image
      const maxWidth = baseImage.width - overlayOffset;
      const maxHeight = baseImage.height - overlayOffset;
      const aspectRatio = overlayImage.width / overlayImage.height;
      let newWidth = maxWidth;
      let newHeight = maxWidth / aspectRatio;

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = maxHeight * aspectRatio;
      }

      //canvasContext.drawImage(image, xOffset, yOffset, newWidth, newHeight);
      //canvasCtx.drawImage(overlayImage, 0, 0);
      // Draw the resized overlay image at the calculated position
      const centerX = Math.floor((baseImage.width - newWidth) / 2);
      const centerY = Math.floor((baseImage.height - newHeight) / 2);
      canvasCtx.drawImage(overlayImage, centerX, centerY, newWidth, newHeight);

      // Convert the resulting canvas to a buffer
      const resultImageBuffer = canvas.toBuffer('image/png');

      return resultImageBuffer;
    } catch (error) {
      console.error('Error loading overlay image:', error);
    }
  },

  getRandomBaseImageRacesAndClasses: function (races, classes) {
    const folderPath = './images'; // Replace with the actual path to your folder
    const files = fs.readdirSync(folderPath);
    let filteredFiles = files.filter((file) => {
      const fileName = path.parse(file).name.toLowerCase();
      const classMatches = classes.some((className) => fileName.includes(className));
      const raceMatches = races.some((raceName) => fileName.includes(raceName));
      return classMatches || raceMatches;
    });

    if (filteredFiles.length === 0) {
      console.log('no matching bg found')
      filteredFiles = files
    }

    const randomIndex = Math.floor(Math.random() * filteredFiles.length);
    const randomFile = filteredFiles[randomIndex];
    const imagePath = path.join(folderPath, randomFile);

    return imagePath;
  },

  getRandomBaseImageSingleFilter: function (racesOrClasses) {
    const folderPath = './images'; // Replace with the actual path to your folder
    const files = fs.readdirSync(folderPath);
    let filteredFiles = files.filter((file) => {
      const fileName = path.parse(file).name.toLowerCase();
      return racesOrClasses.some((smthg) => fileName.includes(smthg));
    });
    if (filteredFiles.length === 0) {
      console.log('no matching bg found')
      filteredFiles = files
    }

    const randomIndex = Math.floor(Math.random() * filteredFiles.length);
    const randomFile = filteredFiles[randomIndex];
    const imagePath = path.join(folderPath, randomFile);

    return imagePath;
  }
}