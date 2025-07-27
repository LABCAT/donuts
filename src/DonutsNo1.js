import { Midi } from '@tonejs/midi';
import { Donut } from './classes/Donut.js';

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
        p.colorMode(p.HSB);
        p.mainDonut = new Donut(p);  
    };
    

    /** 
     * Main draw loop - This is where your animations happen
     * This runs continuously after setup
     */
    p.draw = () => {
        p.background(0, 0, 0);
        p.mainDonut.draw();
        p.mainDonut.update();
        if(p.audioLoaded && p.song.isPlaying() || p.songHasFinished){
            /** 
             * Add your animation code here
             * This will run while the song is playing or has finished
             */
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
            /** 
             * Schedule your cue sets
             * You can add multiple tracks by:
             * 1. Getting notes from different MIDI tracks (e.g., tracks[1], tracks[2])
             * 2. Creating corresponding execute functions (e.g., executeTrack2, executeTrack3)
             * 3. Adding new scheduleCueSet calls for each track
             * Example:
             * const track2 = result.tracks[1].notes;
             * const track3 = result.tracks[2].notes;
             * p.scheduleCueSet(track2, 'executeTrack2');
             * p.scheduleCueSet(track3, 'executeTrack3');
             */
            p.scheduleCueSet(track1, 'executeTrack1');
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
     * Example track execution functions
     * Add your animation triggers here
     */
    p.executeTrack1 = (note) => {
        const { currentCue, durationTicks } = note;
        const duration = (durationTicks / p.PPQ) * (60 / p.bpm);

        p.mainDonut = new Donut(p);
        p.mainDonut.init(duration);
        p.mainDonut.initDraw(duration);
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
};

export default DonutsNo1;