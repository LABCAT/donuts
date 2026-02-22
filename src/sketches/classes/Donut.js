export class Donut {
    shapeOptions = ['ellipse', 'equilateral', 'rect', 'pentagon', 'hexagon', 'octagon'];

    hueOptions = [60, 120, 180, 240, 300, 360];

    constructor(p5, minSize = 0, maxSize = null, x = null, y = null, strokeWeight = 0.1) {
        this.p = p5;
        this.shape = this.p.random(this.shapeOptions);
        this.numOfRotations = this.p.random(6, 36);
        this.minSize = minSize;
        this.maxSize = maxSize || Math.min(this.p.windowWidth, this.p.windowHeight);
        this.strokeWeight = strokeWeight;
        
        // Position properties - default to center if not specified
        this.x = x !== null ? x : this.p.width / 2;
        this.y = y !== null ? y : this.p.height / 2;
        
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
        // Increase the likelihood of using a fixed color for the whole donut (e.g., 80% chance)
        this.useFixedColour = this.p.random() < 0.8; // 80% chance
        this.fixedColour = this.p.random(this.p.currentColorScheme);

        // Create draw elements array - only the main drawing loops
        this.drawElements = [];
        for (let i = 0; i < (this.numOfRotations * 2); i++) {
            for (let j = 0; j <= 4; j++) {
                this.drawElements.push({
                    type: 'shape',
                    rotation: i,
                    size: j,
                    order: i * 5 + j,
                    colour: this.useFixedColour ? this.fixedColour : this.p.random(this.p.currentColorScheme),
                    // Add randomized rotation offset
                    rotationOffset: this.p.random(-this.p.PI, this.p.PI)
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
        this.duration = duration * 1000 * 0.8;
        this.birthTime = this.p.song.currentTime() * 1000;
        this.progress = 0;
    }

    update() {
        const currentTime = this.p.song.currentTime() * 1000;
        const elapsed = currentTime - this.birthTime;
        const rawProgress = elapsed / this.duration;
        this.progress = this.p.constrain(rawProgress, 0, 1);
        
        // Set size based on progress, interpolating between minSize and maxSize
        this.size = this.p.lerp(this.minSize, this.maxSize, this.progress);
        this.hue = this.hue > 360 ? 0 : this.hue++;
    }

    draw() {
        this.updateDrawProgress();
        
        // Setup (always happens)
        this.p.translate(this.x, this.y); 
        this.p.noFill();
        
        // Main drawing loops with progress control
        const elementsToShow = this.drawProgressEnabled ? 
            Math.floor(this.drawElements.length * this.drawProgress) : 
            this.drawElements.length;
        
        for (let i = 0; i < elementsToShow; i++) {
            const element = this.drawElements[i];
            
            // Apply randomized rotation for this element
            this.p.push();
            this.p.rotate(element.rotationOffset);
            this.p.stroke(element.colour);
            this.p.strokeWeight(this.strokeWeight);
            const shapeSize = this.size + element.size;
            this.p[this.shape](0, 20, shapeSize, shapeSize);
            this.p.pop();
        }
        
        // Cleanup (always happens)
        this.p.translate(-this.x, -this.y);
    }
}
