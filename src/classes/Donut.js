export class Donut {
    shapeOptions = ['ellipse', 'equilateral', 'rect', 'pentagon', 'hexagon', 'octagon'];

    colourModes = ['random', 'rainbow', 'complementary', 'triadic', 'tetradic'];

    hueOptions = [60, 120, 180, 240, 300, 360];

    constructor(p5, maxSize = null) {
        this.p = p5;
        this.colour = this.p.color(this.p.random(this.hueOptions), 100, 100);
        this.shape = this.p.random(this.shapeOptions);
        this.numOfRotations = 24;
        this.size = 0;
        this.maxSize = maxSize || Math.min(this.p.windowWidth, this.p.windowHeight);
        
        // Size progress properties
        this.duration = null;
        this.birthTime = null;
        this.progress = 0;
        
        // Draw progress properties
        this.drawProgressEnabled = false;
        this.drawElements = [];
        this.drawProgress = 0;
        this.drawDuration = null;
        this.drawBirthTime = null;
        
        this.initDrawProgress();
    }

    initDrawProgress() {
        // Create draw elements array - only the main drawing loops
        this.drawElements = [];
        for (let i = 0; i < (this.numOfRotations * 2); i++) {
            for (let j = 0; j <= 4; j++) {
                this.drawElements.push({
                    type: 'shape',
                    rotation: i,
                    size: j,
                    order: i * 5 + j
                });
            }
        }
        this.drawElements = this.p.shuffle(this.drawElements);
    }

    initDraw(duration) {
        this.drawProgressEnabled = true;
        this.drawDuration = duration * 1000;
        this.drawBirthTime = this.p.song.currentTime() * 1000;
        this.drawProgress = 0;
    }

    updateDrawProgress() {
        if (this.drawProgressEnabled && this.drawBirthTime) {
            const currentTime = this.p.song.currentTime() * 1000;
            const elapsed = currentTime - this.drawBirthTime;
            const rawProgress = elapsed / this.drawDuration;
            this.drawProgress = this.p.constrain(rawProgress, 0, 1);
        }
    }

    init(duration) {
        this.duration = duration * 1000;
        this.birthTime = this.p.song.currentTime() * 1000;
        this.progress = 0;
    }

    update() {
        const currentTime = this.p.song.currentTime() * 1000;
        const elapsed = currentTime - this.birthTime;
        const rawProgress = elapsed / this.duration;
        this.progress = this.p.constrain(rawProgress, 0, 1);
        
        // Set size based on progress
        this.size = this.maxSize * this.progress;
        this.hue = this.hue > 360 ? 0 : this.hue++;
    }

    draw() {
        this.updateDrawProgress();
        
        // Setup (always happens)
        this.p.translate(this.p.width / 2, this.p.height / 2); 
        this.p.stroke(this.colour);
        this.p.strokeWeight(0.2);
        this.p.noFill();
        
        // Main drawing loops with progress control
        const elementsToShow = this.drawProgressEnabled ? 
            Math.floor(this.drawElements.length * this.drawProgress) : 
            this.drawElements.length;
        
        for (let i = 0; i < elementsToShow; i++) {
            const element = this.drawElements[i];
            this.p[this.shape](0, 20, this.size + element.size, this.size + element.size);
            
            // Rotate after each complete set of sizes
            if (element.size === 4) {
                this.p.rotate(this.p.PI/this.numOfRotations);
            }
        }
        
        // Cleanup (always happens)
        this.p.translate(-this.p.width / 2, -this.p.height / 2);
    }
}