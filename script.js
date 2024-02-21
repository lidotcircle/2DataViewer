const play = document.getElementById('play');
const stop = document.getElementById('stop');
const progress = document.getElementById('progress');
const timestamp = document.getElementById('timestamp');

class Viewport
{
  constructor(canvasId)
  {
    this.m_i2dlayer = i2d.canvasLayer(canvasId, {alpha: false}, {enableEvents: true});
    this.drawtest();
  }

  drawtest()
  {
    let renderer = this.m_i2dlayer;
    var rect = renderer
      .createEl({
        el: "rect",
        attr: {
          x: 50,
          y: 100,
          width: 100,
          height: 100,
        },
        style: {
          fillStyle: "red",
          shadowColor: "#999",
          shadowBlur: 20,
          shadowOffsetX: 15,
          shadowOffsetY: 15,
        },
      })
      .on("mouseover", function () {
        this.setStyle("fillStyle", "green");
      })
      .on("mouseout", function () {
        this.setStyle("fillStyle", "red");
      });

    var polygon = renderer.createEl({
      el: "polygon",
      attr: {
        points: [
          { x: 100, y: 10 },
          { x: 40, y: 198 },
          { x: 190, y: 78 },
          { x: 10, y: 78 },
          { x: 160, y: 198 },
        ],
        transform: {
          translate: [200, 50],
        },
      },
      style: {
        // lineWidth:4,
        fillStyle: "lime",
        // strokeStyle:'purple',
        shadowColor: "#999",
        shadowBlur: 20,
        shadowOffsetX: 15,
        shadowOffsetY: 15,
      },
    });

    var circle = renderer.createEl({
      el: "circle",
      attr: {
        r: 70,
        cx: 0,
        cy: 0,
        transform: {
          translate: [500, 150],
        },
      },
      style: {
        lineWidth: 4,
        strokeStyle: "red",
        shadowColor: "#999",
        shadowBlur: 20,
        shadowOffsetX: 15,
        shadowOffsetY: 15,
      },
    });

    var circle = renderer.createEl({
      el: "line",
      attr: {
        x1: 0,
        x2: 100,
        y1: 0,
        y2: 100,
        transform: {
          translate: [650, 100],
        },
      },
      style: {
        lineWidth: 4,
        strokeStyle: "red",
        shadowColor: "#999",
        shadowBlur: 20,
        shadowOffsetX: 15,
        shadowOffsetY: 15,
      },
    });

    var ellipse = renderer.createEl({
      el: "ellipse",
      attr: {
        cx: 100,
        cy: 0,
        rx: 120,
        ry: 50,
        transform: {
          translate: [800, 150],
        },
      },
      style: {
        // lineWidth:4,
        fillStyle: "lime",
        // strokeStyle:'purple',
        shadowColor: "#999",
        shadowBlur: 20,
        shadowOffsetX: 15,
        shadowOffsetY: 15,
      },
    });

    var rect2 = renderer
      .createEl({
        el: "rect",
        attr: {
          x: 500,
          y: 350,
          width: 150,
          height: 150,
          rx: 25,
          ry: 25,
        },
        style: {
          fillStyle: "red",
          shadowColor: "#999",
          shadowBlur: 20,
          shadowOffsetX: 15,
          shadowOffsetY: 15,
        },
      })
      .on("mouseover", function () {
        this.setStyle("fillStyle", "green");
      })
      .on("mouseout", function () {
        this.setStyle("fillStyle", "red");
      });

    renderer
      .createEl({
        el: "polyline",
        attr: {
          points: [
            { x: 100, y: 10 },
            { x: 150, y: 100 },
            { x: 250, y: 0 },
          ],
          transform: {
            translate: [50, 400],
          },
        },
        style: {
          strokeStyle: "red",
          lineWidth: 4,
        },
      })
      .on("mouseover", function () {
        this.setStyle("strokeStyle", "green");
      })
      .on("mouseout", function () {
        this.setStyle("strokeStyle", "red");
      });
  }

  get paused() { return this.m_paused; }
  get totalFrames() { return this.m_totalFrames; }
  get currentFrame() { return this.m_currentFrame; }

  play()
  {
    this.m_paused = false;
  }

  pause()
  {
    this.m_paused = true;
  }

  setFrame(n)
  {
    this.m_currentFrame = Math.max(Math.min(n, this.m_totalFrames - 1), 0);
  }

  m_paused = true;
  m_currentFrame = 0;
  m_totalFrames = 30;
  m_i2dlayer = null;
}
const viewport = new Viewport('#viewport');

// Play & pause player
function toggleViewportStatus() {
  if (viewport.paused) {
    viewport.play();
  } else {
    viewport.pause();
  }
  updatePlayIcon();
}

// update play/pause icon
function updatePlayIcon() {
  if (viewport.paused) {
    play.classList.add("playbtn")
  } else {
    play.classList.remove("playbtn")
  }
}

// Update progress & timestamp
function updateProgress() {
  const totalFrames = viewport.totalFrames;
  const currentFrame = viewport.currentFrame;
  if (totalFrames == 1) {
    progress.value = 100;
  } else {
    progress.value = (currentFrame / Math.max(totalFrames - 1, 1)) * 100;
  }

  timestamp.innerHTML = `${Math.min(currentFrame + 1, totalFrames)}/${totalFrames}`;
}

// Set viewport frame progress
function setViewportProgress() {
  viewport.setFrame(Math.round(progress.value * Math.max(viewport.totalFrames - 1, 0) / 100));
  updateProgress()
}

// Stop player
function stopViewport() {
  viewport.pause();
  updatePlayIcon();
}


play.addEventListener('click', toggleViewportStatus);

stop.addEventListener('click', stopViewport);

progress.addEventListener('change', setViewportProgress);

updateProgress()