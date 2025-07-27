import { Midi } from '@tonejs/midi';
import { Donut } from './classes/Donut.js';
import ColorGenerator from './lib/p5.colorGenerator.js';

const audio = './audio/donuts-no-1.ogg';
const midi = './audio/donuts-no-1.mid';

const DonutsNo1 = (p) => {
    /** 
     * Core audio properties
     */
    p.song = null;
    p.PPQ = 3840 * 4;
    p.bpm = 54;
    p.audioLoaded = false;
    p.songHasFinished = false;

    /** 
     * Preload function - Loading audio and setting up MIDI
     * This runs first, before setup()
     */
    p.preload = () => {
        /** 
         * Log when preload starts
         */
        p.song = p.loadSound(audio, p.loadMidi);
        p.song.onended(() => p.songHasFinished = true);
    };

    /** 
     * Setup function - Initialize your canvas and any starting properties
     * This runs once after preload
     */
    p.setup = () => {
        const seed = p.hashToSeed(hl.tx.hash + hl.tx.tokenId);
        console.log(`Hash: ${hl.tx.hash}, TokenID: ${hl.tx.tokenId}, Seed: ${seed}`);
        p.randomSeed(seed);
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.canvas.classList.add('p5Canvas--cursor-play');
        p.background(0, 0, 0);
        p.rectMode(p.CENTER);
        p.colorMode(p.HSB);
        p.currentColorScheme = p.generateColourScheme(p.random(p.colourModes));
        p.mainDonut = null;  
        p.subDonuts = [];  
    };
    

    /** 
     * Main draw loop - This is where your animations happen
     * This runs continuously after setup
     */
    p.draw = () => {
        if(p.audioLoaded && p.song.isPlaying() || p.songHasFinished){
            p.background(0, 0, 0);
            if (p.mainDonut) {
                p.mainDonut.draw();
                p.mainDonut.update();
            }
            p.subDonuts.forEach(donut => {
                donut.draw();
                donut.update();
            });
        }
    }

    /** 
     * MIDI loading and processing
     * Handles synchronization between audio and visuals
     */
    p.loadMidi = () => {
        Midi.fromUrl(midi).then((result) => {
            /** 
             * Log when MIDI is loaded
             */
            console.log('MIDI loaded:', result);
            /** 
             * Example: Schedule different tracks for different visual elements
             */
            const track1 = result.tracks[16].notes; // Take Me To Church
            const track2 = result.tracks[10].notes; // Sampler 3 - DBL Bass
            p.scheduleCueSet(track1, 'executeTrack1');
            p.scheduleCueSet(track2, 'executeTrack2');
            /** 
             * Update UI elements when loaded
             */
            document.getElementById("loader").classList.add("loading--complete");
            document.getElementById('play-icon').classList.add('fade-in');
            p.audioLoaded = true;
        });
    };

    /** 
     * Schedule MIDI cues to trigger animations
     * @param {Array} noteSet - Array of MIDI notes
     * @param {String} callbackName - Name of the callback function to execute
     * @param {Boolean} polyMode - Allow multiple notes at same time if true
     */
    p.scheduleCueSet = (noteSet, callbackName, polyMode = false) => {
        let lastTicks = -1,
            currentCue = 1;
        for (let i = 0; i < noteSet.length; i++) {
            const note = noteSet[i],
                { ticks, time } = note;
            if(ticks !== lastTicks || polyMode){
                note.currentCue = currentCue;
                p.song.addCue(time, p[callbackName], note);
                lastTicks = ticks;
                currentCue++;
            }
        }
    }

    p.colourModes = [
        'rainbow',
        'triadic',
        'tetradic',
    ];

    /**
     * Generate color schemes using the ColorGenerator
     * @param {string} scheme - The color scheme type ('random', 'rainbow', 'complementary', 'triadic', 'tetradic', 'splitComplementary', 'shades', 'tints')
     * @param {string} baseColor - Optional base color (hex, rgb, or 'bright' for random bright color)
     * @param {number} numColors - Number of colors to generate (for schemes that support it)
     * @returns {Array} Array of p5.Color objects
     */
    p.generateColourScheme = (scheme = 'random', numColors = 8) => {
        const baseColor = p.color(p.random(0, 360), 100, 100);
        const colorGen = new ColorGenerator(p, baseColor);

        switch (scheme) {
            case 'rainbow':
                // Evenly spaced hues around the color wheel
                const rainbowColors = [];
                for (let i = 0; i < numColors; i++) {
                    const hue = (360 / numColors) * i;
                    rainbowColors.push(p.color(hue, 100, 100));
                }
                return rainbowColors;
            case 'triadic':
                return colorGen.getTriadic ? colorGen.getTriadic() : [colorGen.color];
            case 'tetradic':
                return colorGen.getTetradic ? colorGen.getTetradic() : [colorGen.color];
        }
    };

    /**
     * Get position for sub donut based on pattern type and index
     * @param {number} patternType - The pattern type (0-3)
     * @param {number} donutIndex - The index of the donut in the pattern
     * @returns {object} - Object with x and y coordinates
     */
    p.getSubDonutPosition = (patternType, donutIndex) => {
        switch(patternType) {
            case 'circle': // Circle pattern
                const totalDonuts = 20;
                const angle = (donutIndex / totalDonuts) * p.TWO_PI;
                const radius = Math.min(p.width, p.height) / 2;
                return {
                    x: p.width / 2 + p.cos(angle) * radius,
                    y: p.height / 2 + p.sin(angle) * radius
                };
            case 'infinity': // Infinity symbol pattern
                const totalInfinity = 20;
                const t = (donutIndex / totalInfinity) * p.TWO_PI;
                const infinityRadius = Math.min(p.width, p.height) / 1.5;
                const centerX = p.width / 2;
                const centerY = p.height / 2;
                // Parametric equation for infinity symbol (∞)
                let x, y;
                if (p.isPortraitCanvas()) {
                    // Portrait: rotate 90 degrees by swapping x and y
                    x = centerX + infinityRadius * p.sin(t) * p.cos(t) / (1 + p.sin(t) * p.sin(t));
                    y = centerY - infinityRadius * p.cos(t) / (1 + p.sin(t) * p.sin(t));
                } else {
                    // Landscape: normal orientation
                    x = centerX + infinityRadius * p.cos(t) / (1 + p.sin(t) * p.sin(t));
                    y = centerY + infinityRadius * p.sin(t) * p.cos(t) / (1 + p.sin(t) * p.sin(t));
                }
                
                return { x, y };
            case 'grid': // Staggered grid pattern
                const gridIndex = donutIndex;
                let cols, rows;
                
                if (p.isPortraitCanvas()) {
                    cols = 4;
                    rows = 5;
                } else {
                    cols = 5;
                    rows = 4;
                }
                
                const col = gridIndex % cols;
                const row = Math.floor(gridIndex / cols);
                const gridWidth = p.width / cols;
                const gridHeight = p.height / rows;
                
                // Add stagger to every other row
                const staggerOffset = (row % 2) * (gridWidth / 2);
                
                return {
                    x: col * gridWidth + gridWidth / 2 + staggerOffset,
                    y: row * gridHeight + gridHeight / 2
                };
            case 'spiral': // Spiral pattern
                const spiralIndex = donutIndex;
                const spiralAngle = spiralIndex * 0.5;
                // Use exponential growth for more consistent spacing
                const spiralRadius = 50 + Math.pow(spiralIndex, 1.2) * 12;
                
                return {
                    x: p.width / 2 + p.cos(spiralAngle) * spiralRadius,
                    y: p.height / 2 + p.sin(spiralAngle) * spiralRadius
                };
            case 'diamond': // Diamond pattern
                const diamondIndex = donutIndex;
                const diamondAngle = (diamondIndex / 20) * p.TWO_PI;
                const diamondRadius = Math.min(p.width, p.height) / 1.5;
                // Create diamond shape by using different radius for x and y
                return {
                    x: p.width / 2 + p.cos(diamondAngle) * diamondRadius,
                    y: p.height / 2 + p.sin(diamondAngle) * diamondRadius * 0.6
                };
        }
    };

    /** 
     * Example track execution functions
     * Add your animation triggers here
     */
    p.executeTrack1 = (note) => {
        const { currentCue, durationTicks } = note;
        const duration = (durationTicks / p.PPQ) * (60 / p.bpm);

        // Clear subDonuts array when currentCue % 12 === 1
        if (currentCue % 12 === 1) {
            p.subDonuts = [];
            const patterns = ['circle', 'infinity', 'grid', 'spiral', 'diamond'];
            p.subDonutPattern = p.random(patterns);

            // Prepopulate 20 positions for the pattern with consistent size
            const numSubDonuts = 20;
            // Sub donut size is based on canvas size with some randomization
            const baseSize = Math.min(p.width, p.height) * 0.08;
            let subDonutSize = baseSize * p.random(0.85, 1.15);
            
            // Make spiral pattern donuts smaller
            if (p.subDonutPattern === 'spiral') {
                subDonutSize = subDonutSize * 0.5; // Half the normal size
            }
            let subDonutPositions = [];
            for (let i = 0; i < numSubDonuts; i++) {
                const pos = p.getSubDonutPosition(p.subDonutPattern, i);
                subDonutPositions.push({
                    x: pos.x,
                    y: pos.y,
                    size: subDonutSize
                });
            }
            // Shuffle the array so executeTrack2 can cycle through it
            if (p.subDonutPattern !== 'spiral') {
                p.subDonutPositions = p.shuffle(subDonutPositions);
            }
        }

        // For every 9th, 10th, 11th, and 12th cue, don't divide maxSize by 2
        let minSize, maxSize;
        let x, y;

        if ([8, 9, 10, 11].includes((currentCue - 1) % 12)) {
            minSize = 0;
            maxSize = Math.min(p.windowWidth, p.windowHeight) * 1.2;
            // Always center the donut for these cues
            x = p.width / 2;
            y = p.height / 2;
        } else {
            p.mainDonut = null;
            maxSize = Math.min(p.windowWidth, p.windowHeight) / 2;
            minSize = maxSize / 2;
            // Randomize position based on orientation
            if (p.isPortraitCanvas()) {
                x = p.width / 2;
                y = p.random(0, p.height);
            } else {
                x = p.random(0, p.width);
                y = p.height / 2;
            }
        }

        // Always create one main donut
        p.mainDonut = new Donut(p, minSize, maxSize, x, y, 0.5);
        p.mainDonut.init(duration);
        p.mainDonut.initDraw(duration);
    }

    p.executeTrack2 = (note) => {
        const { currentCue, durationTicks } = note;
        const duration = (durationTicks / p.PPQ) * (60 / p.bpm);

        // Use the subDonutPositions array created in executeTrack1, if available
        let x, y;
        if (Array.isArray(p.subDonutPositions) && p.subDonutPositions.length > 0) {
            // Cycle through the shuffled positions
            const posIndex = p.subDonuts.length % p.subDonutPositions.length;
            const pos = p.subDonutPositions[posIndex];
            x = pos.x;
            y = pos.y;
        } else {
            // Fallback: use the pattern function as before
            const position = p.getSubDonutPosition(p.subDonutPattern, p.subDonuts.length);
            x = position.x;
            y = position.y;
        }

        // Small donuts that don't grow - fixed size
        const size = p.random(20, 60);

        // Create a small donut with fixed size (no growth)
        const subDonut = new Donut(p, size, size, x, y, 0.1);
        p.subDonuts.push(subDonut);
        subDonut.init(duration);
        subDonut.initDraw(duration);
    }

    /** 
     * Handle mouse/touch interaction
     * Controls play/pause and reset functionality
     */
    p.mousePressed = () => {
        if(p.audioLoaded){
            if (p.song.isPlaying()) {
                p.song.pause();
                if (p.canvas) {
                    p.canvas.classList.add('p5Canvas--cursor-play');
                    p.canvas.classList.remove('p5Canvas--cursor-pause');
                }
            } else {
                if (parseInt(p.song.currentTime()) >= parseInt(p.song.buffer.duration)) {
                    /** 
                     * Reset animation properties here
                     */
                }
                document.getElementById("play-icon").classList.remove("fade-in");
                p.song.play();
                if (p.canvas) {
                    p.canvas.classList.add('p5Canvas--cursor-pause');
                    p.canvas.classList.remove('p5Canvas--cursor-play');
                }
            }
        }
    }

     /** 
     * Convert a string to a deterministic seed for p5.js random functions
     * Used with highlight.xyz for consistent generative art
     * @param {String} str - The string to convert to a seed
     * @returns {Number} - A deterministic seed value
     */
    p.hashToSeed = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
        }
        return Math.abs(hash);
    };
    
    /**
     * Utility: Check if the canvas is in portrait orientation
     * @returns {Boolean} true if portrait, false otherwise
     */
    p.isPortraitCanvas = () => {
        return p.height > p.width;
    };
};

export default DonutsNo1;