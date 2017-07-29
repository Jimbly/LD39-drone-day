/*jshint browser:true*/

/*global $: false */
/*global TurbulenzEngine: true */
/*global Draw2D: false */
/*global Camera: false */
/*global VMath: false */
/*global assert: false */

const DEBUG = true;

TurbulenzEngine.onload = function onloadFn()
{
  let intervalID;
  const graphicsDevice = TurbulenzEngine.createGraphicsDevice({});
  const mathDevice = TurbulenzEngine.createMathDevice({});
  let draw2d_params = { graphicsDevice };
  const glov_font = require('./glov_font.js');
  glov_font.populateDraw2DParams(draw2d_params);
  const draw2D = Draw2D.create(draw2d_params);
  const glov_sprite = require('./glov_sprite.js').create(graphicsDevice);
  const inputDevice = TurbulenzEngine.createInputDevice({});
  const input = require('./input.js').create(inputDevice, draw2D);
  const draw_list = require('./draw_list.js').create(draw2D);
  const random_seed = require('random-seed');

  const camera = Camera.create(mathDevice);
  const lookAtPosition = mathDevice.v3Build(0.0, 0.0, 0.0);
  const worldUp = mathDevice.v3BuildYAxis();
  const cameraPosition = mathDevice.v3Build(0.0, 0.0, 1.0);
  camera.lookAt(lookAtPosition, worldUp, cameraPosition);
  camera.updateViewMatrix();
  const sound_manager = require('./sound_manager.js').create(camera.matrix);
  sound_manager.loadSound('test');

  function loadTexture(texname) {
    return glov_sprite.loadTexture(texname);
  }
  function createSprite(texname, params) {
    return glov_sprite.createSprite(texname, params);
  }

  const arial32_info = require('./img/font/arial32.json');
  const default_font = glov_font.create(draw2D, draw_list, arial32_info, loadTexture('arial32.png'));
  const glov_ui = require('./glov_ui.js').create(mathDevice, glov_sprite, input, default_font, draw_list);

  // Preload
  loadTexture('arrows.png');
  loadTexture('background.png');
  loadTexture('base.png');
  loadTexture('drone.png');
  loadTexture('resources.png');

  // Viewport for Draw2D.
  let game_width = 1280;
  let game_height = 960;
  const color_white = mathDevice.v4Build(1, 1, 1, 1);
  const color_has_actor = mathDevice.v4Build(1, 1, 1, 0.1);
  const color_red = mathDevice.v4Build(1, 0, 0, 1);
  const color_yellow = mathDevice.v4Build(1, 1, 0, 1);

  // Cache keyCodes
  const keyCodes = inputDevice.keyCodes;
  const padCodes = input.padCodes;

  let configureParams = {
    scaleMode : 'scale',
    viewportRectangle : mathDevice.v4Build(0, 0, game_width, game_height)
  };

  var global_timer = 0;
  var game_state;

  function titleInit(dt) {
    $('.screen').hide();
    $('#title').show();
    game_state = title;
    title(dt);
  }

  function title(dt) {
    //test(dt);
    if (true && 'ready') {
      game_state = playInit;
    }
  }

  let sprites = {};
  const BASE_SIZE = 3;
  const TILE_SIZE = 64;
  function initGraphics() {
    if (sprites.drone) {
      return;
    }
    let spriteSize = 13;
    let background_tile = 100;
    function buildRects(w, h) {
      let rects = [];
      for (let jj = 0; jj < h; ++jj) {
        for (let ii = 0; ii < w; ++ii) {
          let r = mathDevice.v4Build(ii * spriteSize, jj * spriteSize, (ii + 1) * spriteSize, (jj + 1) * spriteSize);
          rects.push(r);
        }
      }
      return rects;
    }
    sprites.background = createSprite('background.png', {
      width : TILE_SIZE * 4 * background_tile,
      height : TILE_SIZE * 4 * background_tile,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, spriteSize * 4 * background_tile, spriteSize * 4 * background_tile),
      origin: [0,0],
    });
    sprites.drone = createSprite('drone.png', {
      width : TILE_SIZE,
      height : TILE_SIZE,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize),
      origin: [0,0],
    });
    sprites.drone.rects = buildRects(2,2);
    sprites.arrow = createSprite('arrows.png', {
      width : TILE_SIZE,
      height : TILE_SIZE,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize),
      origin: [0,0],
    });
    sprites.arrow.rects = buildRects(2,2);

    sprites.base = createSprite('base.png', {
      width : TILE_SIZE * BASE_SIZE,
      height : TILE_SIZE * BASE_SIZE,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, spriteSize * BASE_SIZE, spriteSize * BASE_SIZE),
      origin: [0,0],
    });
  }

  const MAP_W = 20;
  const MAP_H = 14;
  const actor_types = { 'drone': true };
  const nonblocking_types = { 'arrow': true };
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  class DroneDayState {
    constructor() {
      this.tick_id = 0;
      this.map = new Array(MAP_W);
      this.busy = new Array(MAP_W);
      this.actor_map = new Array(MAP_W);
      for (let ii = 0; ii < MAP_W; ++ii) {
        this.map[ii] = new Array(MAP_H);
        this.busy[ii] = new Array(MAP_H);
        this.actor_map[ii] = new Array(MAP_H);
      }
      let base_x = Math.round((MAP_W - 3) / 2);
      let base_y = Math.round((MAP_H - 3) / 2);
      for (let ii = 0; ii < BASE_SIZE; ++ii) {
        for (let jj = 0; jj < BASE_SIZE; ++jj) {
          this.map[base_x + ii][base_y + jj] = {
            type: 'base',
            draw: false,
          };
        }
      }
      this.map[base_x][base_y].draw = true;
      this.resetActors();
    }

    buyTile(x, y, tile_type, dir) {
      let tile = this.map[x][y];
      if (tile && tile.type === tile_type) {
        // just rotate
        tile.direction = (tile.direction + 1) % 4;
      } else {
        // buy new tile
        tile = this.map[x][y] = {
          type: tile_type,
          direction: dir,
          draw: true,
        };
      }
    }

    resetActors() {
      this.actors = [];
      for (let ii = 0; ii < this.actor_map.length; ++ii) {
        for (let jj = 0; jj < this.actor_map[ii].length; ++jj) {
          this.actor_map[ii][jj] = null;
        }
      }
    }

    initActors() {
      let actors = this.actors = [];
      for (let x = 0; x < this.map.length; ++x) {
        for (let y = 0; y < this.map[x].length; ++y) {
          let tile = this.map[x][y];
          if (!tile || !actor_types[tile.type]) {
            continue;
          }
          assert(tile.type === 'drone');
          let actor = {
            x, y,
            lastx: x,
            lasty: y,
            type: tile.type,
            direction: tile.direction,
          };
          assert(!this.actor_map[x][y]);
          this.actor_map[x][y] = actor;
          actors.push(actor);
        }
      }
    }

    tryMove(actor) {
      let x = actor.x + dx[actor.direction];
      let y = actor.y + dy[actor.direction];
      if (x < 0 || y < 0 || x >= this.map.length || y >= this.map[0].length) {
        // out of bounds
        return false;
      }
      if (this.busy[x][y] > 1) {
        // more than one person moving in, can't move there!
        return false;
      }
      let target_tile = this.map[x][y];
      if (target_tile && !actor_types[target_tile.type] && !nonblocking_types[target_tile.type]) {
        return false;
      }
      let other_actor = this.actor_map[x][y];
      if (other_actor && other_actor.tick_id !== this.tick_id) {
        // someone already there that needs to be ticked
        this.tickActor(other_actor);
        // still there?
        other_actor = this.actor_map[x][y];
      }
      if (other_actor && !other_actor.thinking) {
        // didn't move, not valid
        return false;
      }
      this.actor_map[actor.x][actor.y] = null;
      actor.x = x;
      actor.y = y;
      this.actor_map[actor.x][actor.y] = actor;
      return true;
    }

    tickActorEarly(actor) {
      actor.lastx = actor.x;
      actor.lasty = actor.y;
      actor.last_direction = actor.direction;
      let x = actor.x + dx[actor.direction];
      let y = actor.y + dy[actor.direction];
      if (x < 0 || y < 0 || x >= this.map.length || y >= this.map[0].length) {
        // out of bounds
        return;
      }
      ++this.busy[x][y];
      let other_actor = this.actor_map[x][y];
      if (other_actor && other_actor.direction === (actor.direction + 2) % 4) {
        // can't move directly across one another's paths, block both!
        this.busy[x][y] = 99;
        this.busy[actor.x][actor.y] = 99;
      }
    }

    handleTurn(actor) {
      let tile = this.map[actor.x][actor.y];
      if (!tile) {
        return;
      }
      if (tile.type === 'arrow') {
        actor.direction = tile.direction;
      }
    }

    tickActor(actor) {
      if (actor.tick_id === this.tick_id) {
        return;
      }
      actor.tick_id = this.tick_id;
      actor.thinking = true;
      switch (actor.type) {
      case 'drone':
        this.tryMove(actor);
        this.handleTurn(actor);
        break;
      }
      actor.thinking = false;
    }

    tick() {
      ++this.tick_id;
      for (let ii = 0; ii < this.busy.length; ++ii) {
        for (let jj = 0; jj < this.busy[ii].length; ++jj) {
          this.busy[ii][jj] = 0;
        }
      }
      for (let ii = 0; ii < this.actors.length; ++ii) {
        this.tickActorEarly(this.actors[ii]);
      }
      for (let ii = 0; ii < this.actors.length; ++ii) {
        this.tickActor(this.actors[ii]);
      }
    }
  }

  const Z_TILES = 1;
  const Z_BUILD_TILE = 2;
  const Z_ACTORS = 3;
  const Z_UI = 10;
  const PREVIEW_SPEED = 1000;

  let dd;
  let current_tile;
  let current_direction;
  let play_state;
  let tick_time;
  let tick_countdown;
  function playInit(dt) {
    initGraphics();
    $('.screen').hide();
    $('#play').show();
    game_state = play;
    dd = new DroneDayState();
    current_tile = 'drone';
    current_direction = 2;
    play_state = 'build';

    if (DEBUG) {
      dd.buyTile(2, 3, 'drone', 2);

      dd.buyTile(2, 4, 'arrow', 1);


      dd.buyTile(10, 3, 'drone', 2);
      dd.buyTile(10, 4, 'drone', 0);

      dd.buyTile(5, 2, 'drone', 1);
      dd.buyTile(6, 4, 'drone', 0);
      dd.buyTile(7, 1, 'drone', 2);
      dd.buyTile(8, 3, 'drone', 3);


      dd.buyTile(11, 2, 'drone', 1);
      dd.buyTile(12, 4, 'drone', 0);
      dd.buyTile(13, 1, 'drone', 2);
      dd.buyTile(14, 3, 'drone', 3);
      dd.buyTile(12, 2, 'arrow', 1);
      dd.buyTile(12, 3, 'arrow', 0);
      dd.buyTile(13, 2, 'arrow', 2);
      dd.buyTile(13, 3, 'arrow', 3);

      dd.buyTile(4, 10, 'drone', 2);
      dd.buyTile(4, 12, 'drone', 0);

      previewStart();
    }

    play(dt);
  }

  function drawTile(type, direction, x, y, z, color) {
    direction = direction || 0;
    let s = sprites[type];
    let tex_rect = null;
    if (s.rects) {
      tex_rect = s.rects[direction];
    }
    draw_list.queue(s, x * TILE_SIZE, y * TILE_SIZE, z, color, null, tex_rect);
  }

  function easeInOut(v, a)
  {
    let va = Math.pow(v, a);
    return va / (va + Math.pow(1 - v, a));
  }
  function easeIn(v, a) {
    return 2 * easeInOut(0.5 * v, a);
  }
  function easeOut(v, a) {
    return 2 * easeInOut(0.5 + 0.5 * v, a) - 1;
  }


  function previewStart() {
    play_state = 'preview';
    tick_time = PREVIEW_SPEED;
    tick_countdown = 1;
    dd.initActors();
  }
  function previewEnd() {
    play_state = 'build';
    dd.resetActors();
  }

  const store = [
    {
      type: 'drone',
      display_name: 'Drone',
    },
    {
      type: 'arrow',
      display_name: 'Turn',
    },
  ];

  function play(dt) {
    const BUTTON_H = 64;
    const BUTTON_W = 320;
    if (play_state === 'build') {
      if (glov_ui.buttonText(0, game_height - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H, 'Preview')) {
        previewStart();
      }

      for (let ii = 0; ii < store.length; ++ii) {
        if (glov_ui.buttonText(0, (BUTTON_H + 4) * ii, Z_UI, BUTTON_W, BUTTON_H, store[ii].display_name)) {
          current_tile = store[ii].type;
          current_direction = 2;
        }
      }

    } else if (play_state === 'preview') {
      if (dt >= tick_countdown) {
        dd.tick();
        let dtr = dt - tick_countdown;
        tick_countdown = Math.max(tick_time / 2, tick_time - dtr);
      } else {
        tick_countdown -= dt;
      }
      if (glov_ui.buttonText(0, game_height - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H, 'Stop Preview')) {
        previewEnd();
      }
      const STATUS_H = 32;
      default_font.drawSized(null, BUTTON_W + 10, game_height - STATUS_H - 4, Z_UI, STATUS_H, STATUS_H,
        `Tick timer: ${(tick_countdown/1000).toFixed(2)}`);
    }

    draw_list.queue(sprites.background, -TILE_SIZE * 20, -TILE_SIZE * 20, 1, [1, 1, 1, 1]);
    for (let ii = 0; ii < dd.map.length; ++ii) {
      let x = ii * TILE_SIZE;
      for (let jj = 0; jj < dd.map[ii].length; ++jj) {
        let y = jj * TILE_SIZE;
        let tile = dd.map[ii][jj];
        let do_draw = true;
        if (play_state === 'build') {
          if (!tile || tile.type === current_tile) {
            if (input.clickHit(x, y, TILE_SIZE, TILE_SIZE)) {
              dd.buyTile(ii, jj, current_tile, current_direction);
            } else if (input.isMouseOver(x, y, TILE_SIZE, TILE_SIZE)) {
              let dir = current_direction;
              if (tile && tile.type === current_tile) {
                do_draw = false;
                dir = tile.direction; //(tile.direction + 1) % 4;
              }
              drawTile(current_tile, dir, ii, jj, Z_BUILD_TILE, [1, 1, 1, 0.5]);
            }
          }
        }
        if (tile && tile.draw && do_draw) {
          let color = color_white;
          if (play_state !== 'build' && actor_types[tile.type]) {
            color = color_has_actor;
          }
          drawTile(tile.type, tile.direction, ii, jj, Z_TILES, color);
        }
      }
    }

    let progress = (1 - (tick_countdown / tick_time));
    // [0,0.5,1] -> [0,1,1]
    let blend = easeInOut(
      Math.min(1, Math.max(0, 2 * progress)),
      2
    );
    // [0,bump_time,bump_time*2,1] = [0,0.3,0,0];
    let bump_time = 0.2;
    let bump_blend = 0.3 * easeIn(Math.max(0, 1 - 1/bump_time * Math.abs(bump_time - progress)), 2);
    for (let ii = 0; ii < dd.actors.length; ++ii) {
      let actor = dd.actors[ii];
      let lastx = actor.lastx;
      let lasty = actor.lasty;
      let nextx = actor.x;
      let nexty = actor.y;
      let x, y;
      let direction = actor.direction;
      if (progress < 0.75) {
        direction = actor.last_direction;
      }
      if (lastx !== nextx || lasty !== nexty) {
        x = lastx + (nextx - lastx) * blend;
        y = lasty + (nexty - lasty) * blend;
      } else {
        // tried to move, but can't
        nextx = lastx + dx[actor.direction];
        nexty = lasty + dy[actor.direction];
        x = lastx + (nextx - lastx) * bump_blend;
        y = lasty + (nexty - lasty) * bump_blend;
      }
      drawTile(actor.type, direction, x, y, Z_ACTORS, color_white);
    }
  }

  function test(dt) {
    if (!test.color_sprite) {
      test.color_sprite = color_white;
      var spriteSize = 64;
      test.sprite = createSprite('test.png', {
        width : spriteSize,
        height : spriteSize,
        x : (Math.random() * (game_width - spriteSize) + (spriteSize * 0.5)),
        y : (Math.random() * (game_height - spriteSize) + (spriteSize * 0.5)),
        rotation : 0,
        color : test.color_sprite,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
      test.game_bg = createSprite('white', {
        width : game_width,
        height : game_height,
        x : 0,
        y : 0,
        rotation : 0,
        color : [0, 0.72, 1, 1],
        origin: [0, 0],
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize)
      });
    }

    // test.sprite.x = (Math.random() * (game_width - spriteSize) + (spriteSize * 0.5));
    // test.sprite.y = (Math.random() * (game_height - spriteSize) + (spriteSize * 0.5));

    var character = {
      dx: 0,
      dy: 0,
    };
    if (input.isKeyDown(keyCodes.LEFT) || input.isKeyDown(keyCodes.A) || input.isPadButtonDown(0, padCodes.LEFT)) {
      character.dx = -1;
    } else if (input.isKeyDown(keyCodes.RIGHT) || input.isKeyDown(keyCodes.D) || input.isPadButtonDown(0, padCodes.RIGHT)) {
      character.dx = 1;
    }
    if (input.isKeyDown(keyCodes.UP) || input.isKeyDown(keyCodes.W) || input.isPadButtonDown(0, padCodes.UP)) {
      character.dy = -1;
    } else if (input.isKeyDown(keyCodes.DOWN) || input.isKeyDown(keyCodes.S) || input.isPadButtonDown(0, padCodes.DOWN)) {
      character.dy = 1;
    }

    test.sprite.x += character.dx * dt * 0.2;
    test.sprite.y += character.dy * dt * 0.2;
    if (input.isMouseDown() && input.isMouseOverSprite(test.sprite)) {
      test.sprite.setColor(color_yellow);
    } else if (input.clickHitSprite(test.sprite)) {
      test.color_sprite = (test.color_sprite === color_red) ? color_white : color_red;
      sound_manager.play('test');
    } else if (input.isMouseOverSprite(test.sprite)) {
      test.color_sprite[3] = 0.5;
    } else {
      test.color_sprite[3] = 1;
    }

    draw_list.queue(test.game_bg, 0, 0, 1, [0, 0.72, 1, 1]);
    draw_list.queue(test.sprite, test.sprite.x, test.sprite.y, 2, test.color_sprite);

    let font_test_idx = 0;
    let font_style = null;

    default_font.drawSized(glov_font.styleColored(null, 0x000000ff), test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'TEST!');
    font_style = glov_font.style(null, {
      color: 0xFF00FFff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'TEST2!');
    font_style = glov_font.style(null, {
      outline_width: 2.0,
      outline_color: 0x800080ff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'OUTLINE');
    font_style = glov_font.style(null, {
      outline_width: 2.0,
      outline_color: 0xFFFF00ff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'OUTLINE2');
    font_style = glov_font.style(null, {
      glow_xoffs: 3.25,
      glow_yoffs: 3.25,
      glow_inner: -2.5,
      glow_outer: 5,
      glow_color: 0x000000ff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'Drop Shadow');
    font_style = glov_font.style(null, {
      glow_xoffs: 0,
      glow_yoffs: 0,
      glow_inner: -1,
      glow_outer: 5,
      glow_color: 0xFFFFFFff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'Glow');
    font_style = glov_font.style(null, {
      outline_width: 1.0,
      outline_color: 0x800000ff,
      glow_xoffs: 3.25,
      glow_yoffs: 3.25,
      glow_inner: -2.5,
      glow_outer: 5,
      glow_color: 0x000000ff,
    });
    default_font.drawSized(font_style, test.sprite.x, test.sprite.y + (++font_test_idx * 20), 3, 24, 24,
      'Both');
  }

  game_state = titleInit;

  var last_tick = Date.now();
  function tick() {
    if (!graphicsDevice.beginFrame()) {
      return;
    }
    var now = Date.now();
    var dt = Math.min(Math.max(now - last_tick, 1), 250);
    last_tick = now;
    global_timer += dt;
    sound_manager.tick();
    input.tick();

    {
      let screen_width = graphicsDevice.width;
      let screen_height = graphicsDevice.height;
      let screen_aspect = screen_width / screen_height;
      let view_aspect = game_width / game_height;
      if (screen_aspect > view_aspect) {
        let viewport_width = game_height * screen_aspect;
        let half_diff = (viewport_width - game_width) / 2;
        configureParams.viewportRectangle = [-half_diff, 0, game_width + half_diff, game_height];
      } else {
        let viewport_height = game_width / screen_aspect;
        let half_diff = (viewport_height - game_height) / 2;
        configureParams.viewportRectangle = [0, -half_diff, game_width, game_height + half_diff];
      }
      draw2D.configure(configureParams);
    }

    if (window.need_repos) {
      --window.need_repos;
      var ul = draw2D.viewportUnmap(0, 0);
      var lr = draw2D.viewportUnmap(game_width-1, game_height-1);
      var viewport = [ul[0], ul[1], lr[0], lr[1]];
      var height = viewport[3] - viewport[1];
      // default font size of 16 when at height of game_height
      var font_size = Math.min(256, Math.max(2, Math.floor(height/800 * 16)));
      $('#gamescreen').css({
        left: viewport[0],
        top: viewport[1],
        width: viewport[2] - viewport[0],
        height: height,
        'font-size': font_size,
      });
      $('#fullscreen').css({
        'font-size': font_size,
      });
    }

    draw2D.setBackBuffer();
    draw2D.clear([0, 0, 0, 1]);

    game_state(dt);

    draw_list.draw();

    graphicsDevice.endFrame();
  }

  intervalID = TurbulenzEngine.setInterval(tick, 1000/60);
};
