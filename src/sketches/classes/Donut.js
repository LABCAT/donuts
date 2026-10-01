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
        // Every outline shares one colour — lets draw() set the stroke once instead of
        // per element. retintDonut() forces this true; per-element flyers keep it false.
        this.uniformColour = this.useFixedColour;

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
        this.drawBirthTime = this.p.getSongPlaybackTime() * 1000;
        this.drawProgress = 0;
    }

    updateDrawProgress() {
        if (this.drawProgressEnabled && this.drawBirthTime) {
            const currentTime = this.p.getSongPlaybackTime() * 1000;
            const elapsed = currentTime - this.drawBirthTime;
            const rawProgress = elapsed / this.drawDuration;
            this.drawProgress = this.p.constrain(rawProgress, 0, 1);
        }
    }

    init(duration) {
        this.duration = duration * 1000 * 0.8;
        this.birthTime = this.p.getSongPlaybackTime() * 1000;
        this.progress = 0;
    }

    update() {
        const currentTime = this.p.getSongPlaybackTime() * 1000;
        const elapsed = currentTime - this.birthTime;
        const rawProgress = elapsed / this.duration;
        this.progress = this.p.constrain(rawProgress, 0, 1);
        
        // Set size based on progress, interpolating between minSize and maxSize
        this.size = this.p.lerp(this.minSize, this.maxSize, this.progress);
        this.hue = this.hue > 360 ? 0 : this.hue++;
    }

    // Exact canvas path for one outline at (0, 20), matching what p5 builds for it. p5
    // rebuilds this — a Vector per vertex, a Shape, a converter and a fresh Path2D — for
    // every single outline, which is the bulk of the frame cost at thousands of outlines.
    // Only valid for ellipseMode/rectMode CENTER (all Donuts sketches use CENTER).
    _buildPath(shapeSize) {
        const half = shapeSize / 2;
        const path = new Path2D();
        switch (this.shape) {
            case 'ellipse':
                // ellipseMode CENTER: centred at (0, 20), not corner-anchored.
                path.ellipse(0, 20, half, half, 0, 0, Math.PI * 2);
                path.closePath();
                break;
            case 'rect':
                path.rect(-half, 20 - half, shapeSize, shapeSize);
                break;
            case 'equilateral':
                this._polygonPath(path, half, 3, -Math.PI / 2);
                break;
            case 'pentagon':
                this._polygonPath(path, half, 5, -Math.PI / 2);
                break;
            case 'hexagon':
                this._polygonPath(path, half, 6, 0);
                break;
            case 'octagon':
                this._polygonPath(path, half, 8, (Math.PI * 2) / 16);
                break;
            default:
                return null;
        }
        return path;
    }

    // Mirrors p5.polygon(0, 20, radius, sides, startAngle) vertex-for-vertex.
    _polygonPath(path, radius, sides, startAngle) {
        const angle = (Math.PI * 2) / sides;
        let first = true;
        for (let a = startAngle; a < Math.PI * 2 + startAngle; a += angle) {
            const sx = Math.cos(a) * radius;
            const sy = 20 + Math.sin(a) * radius;
            if (first) {
                path.moveTo(sx, sy);
                first = false;
            } else {
                path.lineTo(sx, sy);
            }
        }
        path.closePath();
    }

    draw() {
        this.updateDrawProgress();

        // Main drawing loops with progress control
        const elementsToShow = this.drawProgressEnabled ?
            Math.floor(this.drawElements.length * this.drawProgress) :
            this.drawElements.length;

        // Nothing to paint — skip the transform churn entirely (no pixels either way).
        if (elementsToShow <= 0) return;

        // Setup (always happens)
        this.p.translate(this.x, this.y);
        this.p.noFill();

        // Uniform-coloured donuts (the common case after retintDonut / for halos) set the
        // stroke once instead of per outline — same colour, same order, identical pixels.
        if (this.uniformColour) {
            this.p.stroke(this.drawElements[0].colour);
            this.p.strokeWeight(this.strokeWeight);
        }

        const ctx = this.p.drawingContext;
        const useRawStack = this.uniformColour;
        const st = this.p._renderer.states;
        const canCache =
            st.ellipseMode === this.p.CENTER && st.rectMode === this.p.CENTER;
        if (canCache && this._pathSize !== this.size) {
            this._pathCache = {};
            this._pathSize = this.size;
        }

        for (let i = 0; i < elementsToShow; i++) {
            const element = this.drawElements[i];
            const shapeSize = this.size + element.size;

            if (useRawStack) {
                // p5's push() also snapshots the whole JS style stack per element. A uniform
                // donut never changes style inside the loop, so raw canvas save/restore
                // restores the exact transform with none of that overhead.
                ctx.save();
                ctx.rotate(element.rotationOffset);
            } else {
                // Non-uniform donuts do change stroke() per element, so they keep p5's stack
                // (its style cache would otherwise desync from the canvas).
                this.p.push();
                this.p.rotate(element.rotationOffset);
                this.p.stroke(element.colour);
                this.p.strokeWeight(this.strokeWeight);
            }

            let path = canCache ? this._pathCache[element.size] : null;
            if (canCache && !path) {
                path = this._buildPath(shapeSize);
                if (path) this._pathCache[element.size] = path;
            }

            if (path) {
                ctx.stroke(path);
            } else {
                this.p[this.shape](0, 20, shapeSize, shapeSize);
            }

            if (useRawStack) {
                ctx.restore();
            } else {
                this.p.pop();
            }
        }

        // Cleanup (always happens)
        this.p.translate(-this.x, -this.y);
    }
}
