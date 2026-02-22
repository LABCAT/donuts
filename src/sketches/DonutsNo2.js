const DonutsNo2 = (p) => {
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.background(0);
  };

  p.draw = () => {
    p.background(0);
    p.noStroke();
    p.fill(220, 80, 100);
    p.torus(120, 40);
  };
};

export default DonutsNo2;
