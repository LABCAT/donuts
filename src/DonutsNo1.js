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
        p.mainDonuts = [];  
        p.subDonuts = [];  
        
        // Generate all six loops with unique patterns and main donut data
        p.loops = p.generateLoopData();
    };

    /**
     * Generate loop data for all six loops
     * Each loop gets unique patterns and main donut configurations
     * @returns {Array} Array of loop objects with pattern, positions, and main donut data
     */
    p.generateLoopData = () => {
        const loops = [];
        const patterns = ['circle', 'infinity', 'grid', 'spiral', 'diamond', 'pentagram', 'flower'];
        
        // Shuffle patterns to ensure each loop gets a unique pattern
        const shuffledPatterns = p.shuffle([...patterns]);
        
        for (let loopIndex = 0; loopIndex < 6; loopIndex++) {
            const pattern = shuffledPatterns[loopIndex];
            const numSubDonuts = 20;
            const baseSize = Math.min(p.width, p.height) * 0.08;
            let subDonutSize = baseSize * p.random(0.85, 1.15);
            
            // Make spiral pattern donuts smaller
            if (pattern === 'spiral') {
                subDonutSize = subDonutSize * 0.5;
            }
            
            let subDonutPositions = [];
            for (let i = 0; i < numSubDonuts; i++) {
                const pos = p.getSubDonutPosition(pattern, i);
                subDonutPositions.push({
                    x: pos.x,
                    y: pos.y,
                    size: subDonutSize
                });
            }
            
            // Shuffle the array for non-spiral patterns
            if (pattern !== 'spiral') {
                subDonutPositions = p.shuffle(subDonutPositions);
            }
            
            // Generate main donut data for this loop
            const mainDonutData = p.generateMainDonutData(loopIndex);
            
            loops.push({
                pattern: pattern,
                positions: subDonutPositions,
                loopIndex: loopIndex,
                mainDonutData: mainDonutData
            });
        }
        
        return loops;
    };

    /**
     * Generate main donut data for a specific loop
     * @param {number} loopIndex - The index of the loop (0-5)
     * @returns {Object} Main donut configuration data
     */
    p.generateMainDonutData = (loopIndex) => {
        const mainDonutData = {
            // For cues 1-7: regular donuts with alternating positions
            regular: {
                minSize: (Math.min(p.windowWidth, p.windowHeight) / 3) * 2 / 3,
                maxSize: (Math.min(p.windowWidth, p.windowHeight) / 3) * 2,
                positions: []
            },
            // For cues 8-11: large centered donuts
            large: {
                minSize: 0,
                maxSizes: [],
                positions: []
            }
        };
        
        // Generate regular donut positions (cues 1-8)
        for (let cue = 1; cue <= 8; cue++) {
            let x, y;
            if (p.isPortraitCanvas()) {
                x = p.width / 2;
                // Alternate between top quarter and bottom three quarters
                y = (cue % 2 === 1) ? p.height * 0.25 : p.height * 0.75;
            } else {
                // Alternate between left quarter and right three quarters
                x = (cue % 2 === 1) ? p.width * 0.25 : p.width * 0.75;
                y = p.height / 2;
            }
            mainDonutData.regular.positions.push({ x, y });
        }
        
        // Generate large donut data (cues 8-11)
        for (let cue = 8; cue <= 11; cue++) {
            const cueModulus = cue - 1;
            const maxSize = Math.max(p.windowWidth, p.windowHeight) * (2 - (0.1 * cueModulus));
            mainDonutData.large.maxSizes.push(maxSize);
            mainDonutData.large.positions.push({
                x: p.width / 2,
                y: p.height / 2
            });
        }
        
        return mainDonutData;
    };
    

    /** 
     * Main draw loop - This is where your animations happen
     * This runs continuously after setup
     */
    p.draw = () => {
        if(p.audioLoaded && p.song.isPlaying() || p.songHasFinished){
            p.background(0, 0, 0);
            p.mainDonuts.forEach(donut => {
                donut.draw();
                donut.update();
            });
            if( p.mainDonuts.length > 1){
                p.background(0, 0, 0, 0.7);
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
                
                if (p.isPortraitCanvas()) {
                    // Portrait: Use columns instead of rows
                    // Define column structure: col 1 = 5, col 2 = 6, col 3 = 5, col 4 = 4
                    const columnStructure = [5, 6, 5, 4];
                    const gridTotalDonuts = columnStructure.reduce((sum, count) => sum + count, 0); // 20 total
                    
                    // Find which column this donut belongs to
                    let currentIndex = 0;
                    let col = 0;
                    let row = 0;
                    
                    for (let i = 0; i < columnStructure.length; i++) {
                        if (gridIndex < currentIndex + columnStructure[i]) {
                            col = i;
                            row = gridIndex - currentIndex;
                            break;
                        }
                        currentIndex += columnStructure[i];
                    }
                    
                    const gridWidth = p.width / columnStructure.length;
                    const gridHeight = p.height / Math.max(...columnStructure); // Use max rows for spacing
                    
                    // Center the donuts in each column based on the number of rows in that column
                    const columnHeight = columnStructure[col] * gridHeight;
                    const startY = (p.height - columnHeight) / 2;
                    
                    // Add negative offset for second and fourth columns
                    let staggerOffset = 0;
                    if (col === 1 || col === 3) { // Second and fourth columns
                        staggerOffset = -((gridHeight / 32) * 1);
                    }
                    
                    return {
                        x: col * gridWidth + gridWidth / 2,
                        y: startY + row * gridHeight + gridHeight / 2 + staggerOffset
                    };
                } else {
                    // Landscape: Use rows as before
                    // Define row structure: row 1 = 5, row 2 = 6, row 3 = 5, row 4 = 4
                    const rowStructure = [5, 6, 5, 4];
                    const gridTotalDonuts = rowStructure.reduce((sum, count) => sum + count, 0); // 20 total
                    
                    // Find which row this donut belongs to
                    let currentIndex = 0;
                    let row = 0;
                    let col = 0;
                    
                    for (let i = 0; i < rowStructure.length; i++) {
                        if (gridIndex < currentIndex + rowStructure[i]) {
                            row = i;
                            col = gridIndex - currentIndex;
                            break;
                        }
                        currentIndex += rowStructure[i];
                    }
                    
                    const gridHeight = p.height / rowStructure.length;
                    const gridWidth = p.width / Math.max(...rowStructure); // Use max columns for spacing
                    
                    // Center the donuts in each row based on the number of columns in that row
                    const rowWidth = rowStructure[row] * gridWidth;
                    const startX = (p.width - rowWidth) / 2;
                    
                    // Add negative offset for second and fourth rows
                    let staggerOffset = 0;
                    if (row === 1 || row === 3) { // Second and fourth rows
                        staggerOffset = -((gridWidth / 32) * 1);
                    }
                    
                    return {
                        x: startX + col * gridWidth + gridWidth / 2 + staggerOffset,
                        y: row * gridHeight + gridHeight / 2
                    };
                }
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
            case 'pentagram': // Sacred geometry pentagram pattern
                const pentagramIndex = donutIndex;
                
                if (pentagramIndex < 5) {
                    // First 5 donuts form the pentagram points
                    const pentagramAngle = (pentagramIndex / 5) * p.TWO_PI - p.PI / 2; // Start from top
                    const pentagramRadius = Math.min(p.width, p.height) * 0.25;
                    
                    return {
                        x: p.width / 2 + p.cos(pentagramAngle) * pentagramRadius,
                        y: p.height / 2 + p.sin(pentagramAngle) * pentagramRadius
                    };
                } else {
                    // Remaining 15 donuts form a circle around the pentagram
                    const circleIndex = pentagramIndex - 5;
                    const circleAngle = (circleIndex / 15) * p.TWO_PI;
                    const circleRadius = Math.min(p.width, p.height) * 0.45;
                    
                    return {
                        x: p.width / 2 + p.cos(circleAngle) * circleRadius,
                        y: p.height / 2 + p.sin(circleAngle) * circleRadius
                    };
                }
            case 'flower': // Sacred geometry Flower of Life pattern
                const flowerIndex = donutIndex;
                const flowerRadius = Math.min(p.width, p.height) * 0.15;
                
                if (flowerIndex < 7) {
                    // First 7 donuts form the classic Flower of Life pattern
                    // Center circle + 6 surrounding circles
                    if (flowerIndex === 0) {
                        // Center circle
                        return {
                            x: p.width / 2,
                            y: p.height / 2
                        };
                    } else {
                        // 6 surrounding circles
                        const angle = ((flowerIndex - 1) / 6) * p.TWO_PI;
                        return {
                            x: p.width / 2 + p.cos(angle) * flowerRadius,
                            y: p.height / 2 + p.sin(angle) * flowerRadius
                        };
                    }
                } else {
                    // Remaining 13 donuts form an outer ring
                    const outerIndex = flowerIndex - 7;
                    const outerAngle = (outerIndex / 13) * p.TWO_PI;
                    const outerRadius = flowerRadius * 2.5;
                    
                    return {
                        x: p.width / 2 + p.cos(outerAngle) * outerRadius,
                        y: p.height / 2 + p.sin(outerAngle) * outerRadius
                    };
                }
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
            // Determine which loop we're starting (0-5)
            const loopIndex = Math.floor((currentCue - 1) / 12) % 6;
            const currentLoop = p.loops[loopIndex];
            p.subDonutPattern = currentLoop.pattern;
            p.subDonutPositions = currentLoop.positions;
        }

        // Use pre-generated main donut data from the current loop
        const loopIndex = Math.floor((currentCue - 1) / 12) % 6;
        const currentLoop = p.loops[loopIndex];
        const mainDonutData = currentLoop.mainDonutData;
        
        let minSize, maxSize;
        let x, y;

        const cueModulus = (currentCue - 1) % 12;
        if ([8, 9, 10, 11].includes(cueModulus)) {
            if (cueModulus === 8) {
                p.mainDonuts = [];
            }
            minSize = mainDonutData.large.minSize;
            maxSize = mainDonutData.large.maxSizes[cueModulus - 8];
            const position = mainDonutData.large.positions[cueModulus - 8];
            x = position.x;
            y = position.y;
        } else {
            p.mainDonuts = [];
            minSize = mainDonutData.regular.minSize;
            maxSize = mainDonutData.regular.maxSize;
            // cueModulus 0-7 corresponds to cues 1-8, map to array indices 0-7
            const positionIndex = cueModulus;
            const position = mainDonutData.regular.positions[positionIndex];
            x = position.x;
            y = position.y;
        }

        // Always create one main donut
        const mainDonut = new Donut(p, minSize, maxSize, x, y, 0.5);
        mainDonut.init(duration);
        mainDonut.initDraw(duration);
        p.mainDonuts.push(mainDonut);
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