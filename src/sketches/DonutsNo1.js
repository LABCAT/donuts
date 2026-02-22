import p5 from 'p5';
window.p5 = p5;
import '@lib/p5.audioReact.js';
import initCapture from '@lib/p5.capture.js';
import '@lib/p5.polygon.js';
import { Donut } from './classes/Donut.js';
import ColorGenerator from '@lib/p5.colorGenerator.js';

const base = import.meta.env.BASE_URL || './';
const audio = base + 'audio/DonutsNo1.ogg';
const midi = base + 'audio/DonutsNo1.mid';

const DonutsNo1 = (p) => {
  p.song = null;
  p.audioSampleRate = 0;
  p.totalAnimationFrames = 0;
  p.PPQ = 3840 * 4;
  p.bpm = 54;
  p.audioLoaded = false;
  p.songHasFinished = false;
  p.showingStatic = true;

  p.preload = () => {
    p.loadSong(audio, midi, (result) => {
      const track1 = result.tracks[16].notes;
      const track2 = result.tracks[10].notes;
      p.scheduleCueSet(track1, 'executeTrack1');
      p.scheduleCueSet(track2, 'executeTrack2');
      p.hideLoader();
    });
  };

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.canvas.classList.add('p5Canvas--cursor-play');
    p.canvas.style.position = 'relative';
    p.canvas.style.zIndex = '1';
    initCapture(p, {
      prefix: 'DonutsNo1',
      enabled: false,
      captureCSSBackground: false,
    });

    const seed =
      typeof hl !== 'undefined' && hl?.tx
        ? p.hashToSeed(hl.tx.hash + hl.tx.tokenId)
        : Math.floor(Math.random() * 1e9);
    if (typeof hl !== 'undefined' && hl?.tx) {
      console.log(
        `Hash: ${hl.tx.hash}, TokenID: ${hl.tx.tokenId}, Seed: ${seed}`
      );
    }
    p.randomSeed(seed);
    p.background(0, 0, 0);
    p.rectMode(p.CENTER);
    p.colorMode(p.HSB);
    p.currentColorScheme = p.generateColourScheme(p.random(p.colourModes));
    p.mainDonuts = [];
    p.subDonuts = [];
    p.loops = p.generateLoopData();
  };

  p.generateLoopData = () => {
    const loops = [];
    const patterns = ['circle', 'infinity', 'grid', 'spiral', 'diamond', 'pentagram', 'flower'];
    const shuffledPatterns = p.shuffle([...patterns]);

    for (let loopIndex = 0; loopIndex < 6; loopIndex++) {
      const pattern = shuffledPatterns[loopIndex];
      const numSubDonuts = 20;
      const baseSize = Math.min(p.width, p.height) * 0.08;
      let subDonutSize = baseSize * p.random(0.85, 1.15);
      if (pattern === 'spiral') subDonutSize = subDonutSize * 0.5;

      let subDonutPositions = [];
      for (let i = 0; i < numSubDonuts; i++) {
        const pos = p.getSubDonutPosition(pattern, i);
        subDonutPositions.push({ x: pos.x, y: pos.y, size: subDonutSize });
      }
      if (pattern !== 'spiral') subDonutPositions = p.shuffle(subDonutPositions);
      const mainDonutData = p.generateMainDonutData(loopIndex);
      loops.push({ pattern, positions: subDonutPositions, loopIndex, mainDonutData });
    }
    return loops;
  };

  p.generateMainDonutData = (loopIndex) => {
    const mainDonutData = {
      regular: {
        minSize: (Math.min(p.windowWidth, p.windowHeight) / 3) * 2 / 3,
        maxSize: (Math.min(p.windowWidth, p.windowHeight) / 3) * 2,
        positions: [],
      },
      large: { minSize: 0, maxSizes: [], positions: [] },
    };
    for (let cue = 1; cue <= 8; cue++) {
      let x, y;
      if (p.isPortraitCanvas()) {
        x = p.width / 2;
        y = (cue % 2 === 1) ? p.height * 0.25 : p.height * 0.75;
      } else {
        x = (cue % 2 === 1) ? p.width * 0.25 : p.width * 0.75;
        y = p.height / 2;
      }
      mainDonutData.regular.positions.push({ x, y });
    }
    for (let cue = 8; cue <= 11; cue++) {
      const cueModulus = cue - 1;
      const maxSize = Math.max(p.windowWidth, p.windowHeight) * (2 - (0.1 * cueModulus));
      mainDonutData.large.maxSizes.push(maxSize);
      mainDonutData.large.positions.push({ x: p.width / 2, y: p.height / 2 });
    }
    return mainDonutData;
  };

  p.draw = () => {
    if (p.showingStatic) {
      p.background(0, 0, 0);
      const finalLoop = p.loops[5];
      if (finalLoop) p.displayStaticLoop(finalLoop);
      if (typeof hl !== 'undefined' && hl?.token?.capturePreview) hl.token.capturePreview();
      p.noLoop();
    } else if ((p.audioLoaded && p.song.isPlaying()) || p.songHasFinished) {
      p.background(0, 0, 0);
      p.mainDonuts.forEach((donut) => {
        donut.draw();
        donut.update();
      });
      if (p.mainDonuts.length > 1) p.background(0, 0, 0, 0.7);
      p.subDonuts.forEach((donut) => {
        donut.draw();
        donut.update();
      });
    }
  };

  p.colourModes = ['rainbow', 'triadic', 'tetradic'];

  p.generateColourScheme = (scheme = 'random', numColors = 8) => {
    const baseColor = p.color(p.random(0, 360), 100, 100);
    const colorGen = new ColorGenerator(p, baseColor);
    switch (scheme) {
      case 'rainbow': {
        const rainbowColors = [];
        for (let i = 0; i < numColors; i++) {
          rainbowColors.push(p.color((360 / numColors) * i, 100, 100));
        }
        return rainbowColors;
      }
      case 'triadic':
        return colorGen.getTriadic ? colorGen.getTriadic() : [colorGen.color];
      case 'tetradic':
        return colorGen.getTetradic ? colorGen.getTetradic() : [colorGen.color];
      default:
        return [baseColor];
    }
  };

  p.getSubDonutPosition = (patternType, donutIndex) => {
    switch (patternType) {
      case 'circle': {
        const totalDonuts = 20;
        const angle = (donutIndex / totalDonuts) * p.TWO_PI;
        const radius = Math.min(p.width, p.height) / 2;
        return { x: p.width / 2 + p.cos(angle) * radius, y: p.height / 2 + p.sin(angle) * radius };
      }
      case 'infinity': {
        const totalInfinity = 20;
        const t = (donutIndex / totalInfinity) * p.TWO_PI;
        const infinityRadius = Math.min(p.width, p.height) / 1.5;
        const centerX = p.width / 2, centerY = p.height / 2;
        let x, y;
        if (p.isPortraitCanvas()) {
          x = centerX + infinityRadius * p.sin(t) * p.cos(t) / (1 + p.sin(t) * p.sin(t));
          y = centerY - infinityRadius * p.cos(t) / (1 + p.sin(t) * p.sin(t));
        } else {
          x = centerX + infinityRadius * p.cos(t) / (1 + p.sin(t) * p.sin(t));
          y = centerY + infinityRadius * p.sin(t) * p.cos(t) / (1 + p.sin(t) * p.sin(t));
        }
        return { x, y };
      }
      case 'grid': {
        const gridIndex = donutIndex;
        if (p.isPortraitCanvas()) {
          const columnStructure = [5, 6, 5, 4];
          let currentIndex = 0, col = 0, row = 0;
          for (let i = 0; i < columnStructure.length; i++) {
            if (gridIndex < currentIndex + columnStructure[i]) {
              col = i;
              row = gridIndex - currentIndex;
              break;
            }
            currentIndex += columnStructure[i];
          }
          const gridWidth = p.width / columnStructure.length;
          const gridHeight = p.height / Math.max(...columnStructure);
          const columnHeight = columnStructure[col] * gridHeight;
          const startY = (p.height - columnHeight) / 2;
          let staggerOffset = (col === 1 || col === 3) ? -((gridHeight / 32) * 1) : 0;
          return {
            x: col * gridWidth + gridWidth / 2,
            y: startY + row * gridHeight + gridHeight / 2 + staggerOffset,
          };
        } else {
          const rowStructure = [5, 6, 5, 4];
          let currentIndex = 0, row = 0, col = 0;
          for (let i = 0; i < rowStructure.length; i++) {
            if (gridIndex < currentIndex + rowStructure[i]) {
              row = i;
              col = gridIndex - currentIndex;
              break;
            }
            currentIndex += rowStructure[i];
          }
          const gridHeight = p.height / rowStructure.length;
          const gridWidth = p.width / Math.max(...rowStructure);
          const rowWidth = rowStructure[row] * gridWidth;
          const startX = (p.width - rowWidth) / 2;
          let staggerOffset = (row === 1 || row === 3) ? -((gridWidth / 32) * 1) : 0;
          return {
            x: startX + col * gridWidth + gridWidth / 2 + staggerOffset,
            y: row * gridHeight + gridHeight / 2,
          };
        }
      }
      case 'spiral': {
        const spiralIndex = donutIndex;
        const spiralAngle = spiralIndex * 0.5;
        const spiralRadius = 50 + Math.pow(spiralIndex, 1.2) * 12;
        return {
          x: p.width / 2 + p.cos(spiralAngle) * spiralRadius,
          y: p.height / 2 + p.sin(spiralAngle) * spiralRadius,
        };
      }
      case 'diamond': {
        const diamondIndex = donutIndex;
        const diamondAngle = (diamondIndex / 20) * p.TWO_PI;
        const diamondRadius = Math.min(p.width, p.height) / 1.5;
        return {
          x: p.width / 2 + p.cos(diamondAngle) * diamondRadius,
          y: p.height / 2 + p.sin(diamondAngle) * diamondRadius * 0.6,
        };
      }
      case 'pentagram': {
        if (donutIndex < 5) {
          const pentagramAngle = (donutIndex / 5) * p.TWO_PI - p.PI / 2;
          const pentagramRadius = Math.min(p.width, p.height) * 0.25;
          return {
            x: p.width / 2 + p.cos(pentagramAngle) * pentagramRadius,
            y: p.height / 2 + p.sin(pentagramAngle) * pentagramRadius,
          };
        } else {
          const circleIndex = donutIndex - 5;
          const circleAngle = (circleIndex / 15) * p.TWO_PI;
          const circleRadius = Math.min(p.width, p.height) * 0.45;
          return {
            x: p.width / 2 + p.cos(circleAngle) * circleRadius,
            y: p.height / 2 + p.sin(circleAngle) * circleRadius,
          };
        }
      }
      case 'flower': {
        const flowerIndex = donutIndex;
        const flowerRadius = Math.min(p.width, p.height) * 0.15;
        if (flowerIndex < 7) {
          if (flowerIndex === 0) return { x: p.width / 2, y: p.height / 2 };
          const angle = ((flowerIndex - 1) / 6) * p.TWO_PI;
          return {
            x: p.width / 2 + p.cos(angle) * flowerRadius,
            y: p.height / 2 + p.sin(angle) * flowerRadius,
          };
        } else {
          const outerIndex = flowerIndex - 7;
          const outerAngle = (outerIndex / 13) * p.TWO_PI;
          const outerRadius = flowerRadius * 2.5;
          return {
            x: p.width / 2 + p.cos(outerAngle) * outerRadius,
            y: p.height / 2 + p.sin(outerAngle) * outerRadius,
          };
        }
      }
      default:
        return { x: p.width / 2, y: p.height / 2 };
    }
  };

  p.executeTrack1 = (note) => {
    const { currentCue, durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
    if (currentCue % 12 === 1) {
      p.subDonuts = [];
      const loopIndex = Math.floor((currentCue - 1) / 12) % 6;
      const currentLoop = p.loops[loopIndex];
      p.subDonutPattern = currentLoop.pattern;
      p.subDonutPositions = currentLoop.positions;
    }
    const loopIndex = Math.floor((currentCue - 1) / 12) % 6;
    const currentLoop = p.loops[loopIndex];
    const mainDonutData = currentLoop.mainDonutData;
    let minSize, maxSize, x, y;
    const cueModulus = (currentCue - 1) % 12;
    if ([8, 9, 10, 11].includes(cueModulus)) {
      if (cueModulus === 8) p.mainDonuts = [];
      minSize = mainDonutData.large.minSize;
      maxSize = mainDonutData.large.maxSizes[cueModulus - 8];
      const position = mainDonutData.large.positions[cueModulus - 8];
      x = position.x;
      y = position.y;
    } else {
      p.mainDonuts = [];
      minSize = mainDonutData.regular.minSize;
      maxSize = mainDonutData.regular.maxSize;
      const positionIndex = cueModulus;
      const position = mainDonutData.regular.positions[positionIndex];
      x = position.x;
      y = position.y;
    }
    const mainDonut = new Donut(p, minSize, maxSize, x, y, 0.5);
    mainDonut.init(duration);
    mainDonut.initDraw(duration);
    p.mainDonuts.push(mainDonut);
  };

  p.executeTrack2 = (note) => {
    const { durationTicks } = note;
    const duration = (durationTicks / p.PPQ) * (60 / p.bpm);
    let x, y;
    if (Array.isArray(p.subDonutPositions) && p.subDonutPositions.length > 0) {
      const posIndex = p.subDonuts.length % p.subDonutPositions.length;
      const pos = p.subDonutPositions[posIndex];
      x = pos.x;
      y = pos.y;
    } else {
      const position = p.getSubDonutPosition(p.subDonutPattern, p.subDonuts.length);
      x = position.x;
      y = position.y;
    }
    const size = p.random(20, 60);
    const subDonut = new Donut(p, size, size, x, y, 0.1);
    p.subDonuts.push(subDonut);
    subDonut.init(duration);
    subDonut.initDraw(duration);
  };

  p.displayStaticLoop = (loop) => {
    const mainDonutData = loop.mainDonutData;
    for (let i = 0; i < 4; i++) {
      const maxSize = mainDonutData.large.maxSizes[i] * 0.8;
      const pos = mainDonutData.large.positions[i];
      const mainDonut = new Donut(p, 0, maxSize, pos.x, pos.y, 0.5);
      mainDonut.size = maxSize;
      mainDonut.drawProgressEnabled = true;
      mainDonut.drawProgress = 1;
      mainDonut.draw();
    }
    p.background(0, 0, 0, 0.7);
    loop.positions.forEach((pos, index) => {
      const subSize = pos.size || 30;
      const subDonut = new Donut(p, subSize, subSize, pos.x, pos.y, 0.1);
      subDonut.size = subSize;
      subDonut.drawProgressEnabled = true;
      subDonut.drawProgress = 1;
      subDonut.draw();
    });
  };

  p.mousePressed = () => {
    p.togglePlayback();
    if (p.audioLoaded && p.song?.isPlaying()) p.loop();
  };

  p.hashToSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return Math.abs(hash);
  };

  p.isPortraitCanvas = () => p.height > p.width;
};

export default DonutsNo1;
