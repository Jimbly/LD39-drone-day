/*jshint browser:true, noempty:false*/

/*global $: false */
/*global TurbulenzEngine: true */
/*global Draw2D: false */
/*global Camera: false */
/*global VMath: false */
/*global assert: false */

const DEBUG = false;

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
  const score = require('./score.js');

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
  loadTexture('sell.png');
  loadTexture('upgrade_power.png');

  // Viewport for Draw2D.
  let game_width = 1280;
  let game_height = 960;
  const color_white = mathDevice.v4Build(1, 1, 1, 1);
  const color_has_actor = mathDevice.v4Build(1, 1, 1, 0.1);
  const color_resource_depleted = mathDevice.v4Build(0.2, 0.2, 0.2, 1);
  const color_resource_non_full = mathDevice.v4Build(0.7, 0.7, 0.7, 1);
  const color_red = mathDevice.v4Build(1, 0, 0, 1);
  const color_yellow = mathDevice.v4Build(1, 1, 0, 1);

  // Cache keyCodes
  const keyCodes = inputDevice.keyCodes;
  const padCodes = input.padCodes;

  let configureParams = {
    scaleMode : 'scale',
    viewportRectangle : mathDevice.v4Build(0, 0, game_width, game_height)
  };

  let sprites = {};
  let global_timer = 0;
  let game_state;

  function updateScoresDisplay(level_name) {
    let scores = score.high_scores[level_name];
    let html = [];
    if (scores) {
      let last_unique = 0;
      let last_unique_score = scores[0] ? score.formatScore(scores[0]) : '';
      for (let ii = 0; ii < scores.length; ++ii) {
        let high_score = scores[ii];
        let name = score.formatName(high_score);
        let score_disp = score.formatScore(high_score.score);
        let me = high_score.name === score.player_name;
        if (score_disp === last_unique_score) {
          // same, no index update
        } else{
          last_unique_score = score_disp;
          last_unique = ii;
        }
        html.push(`<div class="score${me ? ' me' : ''}">#${last_unique + 1}: ${score_disp} - ${name}</div>`);
      }
    }
    $('#score_list').html(html.join('\n'));
  }
  let scores_viewing_level;
  function viewScores() {
    score.updateHighScores(level_defs, function () {
      updateScoresDisplay(scores_viewing_level);
    });
    const BUTTON_H = 64;
    const BUTTON_W = 320;
    if (glov_ui.buttonText(configureParams.viewportRectangle[2] - BUTTON_W,
      configureParams.viewportRectangle[3] - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H, 'Back')) {
      game_state = playInit;
    }
  }
  function viewScoresInit(level_name) {
    scores_viewing_level = level_name;
    game_state = viewScores;
    $('#level_name').text(level_name);
    updateScoresDisplay(level_name);
    $('.screen').hide();
    $('#scores').show();

    if (!viewScoresInit.once) {
      viewScoresInit.once = true;
      if (score.player_name.indexOf('Anonymous') !== 0) {
        $('#name').val(score.player_name);
      }
      $('#name').focus(function () {
        inputDevice.onBlur();
      });
      $('#name').change(function (ev) {
        score.updatePlayerName(level_defs, $('#name').val());
      });
      $('#name').blur(function () {
        // submitScore();
      });
    }
    $('#name').focus();
  }

  function titleInit(dt) {
    $('.screen').hide();
    $('#title').show();
    game_state = title;
    title(dt);
  }

  function title() {
    //test(dt);
    if (true && 'ready') {
      game_state = playInit;
    }
  }

  let indicator_pos = {};
  let tutorial_states = [
    null,
    {
      msg: [
        'Welcome to Drone Supervisor!',
        'You earn money by having Drones',
        'deliver resources to your base.',
        'To get started, select the',
        'Build Drone tool.',
      ],
      indicator_name: 'buy_drone',
      indicator: {x: 100, y: 100},
      done: function () {
        return current_tile === 'drone';
      },
    },
    {
      msg: [
        'Now, place a Drone in the',
        'indicated square.',
      ],
      indicator: {x: 0, y: 3},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 0 && y === 3 && tile_type === 'drone';
      },
      done: function () {
        return dd.map[0][3] && dd.map[0][3].type === 'drone';
      },
    },
    {
      msg: [
        'Good job!',
        'Now, we want this Drone to',
        'travel to the right.',
        'Click on the newly placed Drone',
        'until he faces to the right,',
        'towards your Base in the center',
        'of the level.',
      ],
      indicator: {x: 0, y: 3},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 0 && y === 3 && tile_type === 'drone';
      },
      done: function () {
        return dd.map[0][3] && dd.map[0][3].direction === 1;
      },
    },
    {
      msg: [
        'Perfect. Let\'s see how',
        'he\'ll do.  Click Preview.',
      ],
      indicator_name: 'preview',
      done: function () {
        return play_state === 'preview';
      },
    },
    {
      msg: null,
      done: function () {
        return dd.power < 0;
      },
    },
    {
      msg: [
        'Great! He picked up and sold',
        'one Gold, worth $100.',
        'If you want to see that again,',
        'choose Cancel, and click Preview',
        'again.',
        'To continue, click Next Turn,',
        'cashing in your earnings.',
      ],
      indicator_name: 'next_turn',
      done: function () {
        return play_state === 'build' && dd.turn === 1;
      },
    },
    {
      msg: [
        'Now it\'s another turn and',
        'we have more money to spend.',
        '',
        'Let\s harvest the Silver, this',
        'will require changint the',
        'direction of Drones with Arrows.',
        '',
        'Select the Arrow tool.',
      ],
      indicator_name: 'buy_arrow',
      done: function () {
        return current_tile === 'arrow';
      },
    },
    {
      msg: [
        'Now, place a Down Arrow in',
        'the indicated square.',
      ],
      indicator: {x: 3, y: 6},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 3 && y === 6 && tile_type === 'arrow';
      },
      done: function () {
        return dd.map[3][6] && dd.map[3][6].type === 'arrow' &&
          dd.map[3][6].direction === 2;
      },
    },
    {
      msg: [
        'And an Up Arrow in',
        'this indicated square.',
      ],
      indicator: {x: 3, y: 7},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 3 && y === 7 && tile_type === 'arrow';
      },
      done: function () {
        return dd.map[3][7] && dd.map[3][7].type === 'arrow' &&
          dd.map[3][7].direction === 0;
      },
    },
    {
      msg: [
        'Great!',
        '',
        'Now, a Drone facing left here.',
      ],
      indicator: {x: 4, y: 6},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 4 && y === 6 && tile_type === 'drone';
      },
      done: function () {
        return dd.map[4][6] && dd.map[4][6].type === 'drone' &&
          dd.map[4][6].direction === 3;
      },
    },
    {
      msg: [
        'One last thing, let\'s move',
        'our first drone somewhere',
        'better.',
        '',
        'Pick it up by right clicking,',
        'shift-clicking, or using the',
        'Sell tool.',
      ],
      indicator: {x: 0, y: 3},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 0 && y === 3 && !tile_type;
      },
      done: function () {
        return !dd.map[0][3];
      },
    },
    {
      msg: [
        'Put it back down, facing right,',
        'right here.',
      ],
      indicator: {x: 2, y: 4},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 2 && y === 4 && tile_type === 'drone';
      },
      done: function () {
        return dd.map[2][4] && dd.map[2][4].type === 'drone' &&
          dd.map[2][4].direction === 1;
      },
    },
    {
      msg: [
        'Perfect. Let\'s get some',
        'more money.  Click Preview.',
      ],
      indicator_name: 'preview',
      done: function () {
        return play_state === 'preview';
      },
    },
    {
      msg: null,
      done: function () {
        return dd.power < 0;
      },
    },
    {
      msg: [
        'See how the left Drone stayed',
        'in one place and sold all of',
        'the Gold?',
        'Notice the right Drone following',
        'the arrows we placed.',
        '',
        'To continue, click Next Turn,',
        'cashing in your earnings.',
      ],
      indicator_name: 'next_turn',
      done: function () {
        return play_state === 'build' && dd.turn === 2;
      },
    },
    {
      msg: [
        'At the top, it says our goal',
        'is to Craft and Sell 1',
        'jewlery.  We do not have enough',
        'money to build a crafting',
        'station yet, so run one more turn',
        'with this same configuration.',
      ],
      indicator_name: 'preview',
      done: function () {
        return play_state === 'preview';
      },
    },
    {
      msg: null,
      done: function () {
        return dd.power < 0;
      },
    },
    {
      msg: [
        'Great, that should be',
        'enough money!',
      ],
      indicator_name: 'next_turn',
      done: function () {
        let ret = play_state === 'build' && dd.turn === 3;
        if (ret) {
          dd.money = 1400;
        }
        return ret;
      },
    },
    {
      msg: [
        'Now, remove both drones and',
        'both arrows to reclaim our',
        'money.',
      ],
      indicator_name: 'buy_sell',
      buy_validate: function (x, y, tile_type, dir) {
        return !tile_type;
      },
      done: function () {
        return dd.countOf('drone') + dd.countOf('arrow') === 0;
      },
    },
    {
      msg: [
        'Select the 2-Node Crafting',
        'Station.',
      ],
      indicator_name: 'buy_craft2',
      done: function () {
        return current_tile === 'craft2';
      },
    },
    {
      msg: [
        'And place it here, with the',
        'Output node (red) in the',
        'upper right.',
      ],
      indicator: {x: 1, y: 6},
      buy_validate: function (x, y, tile_type, dir) {
        return x === 1 && y === 6 && tile_type === 'craft2';
      },
      done: function () {
        return dd.map[1][6] && dd.map[1][6].type === 'craft2' &&
          dd.map[1][6].direction === 0;
      },
    },
    {
      msg: [
        'Finally, place 3 Drones and',
        '2 Arrows in the configuration',
        'shown here:',
        '','','',
        '','','',
        '','','',
        '','',
      ],
      buy_validate: function (x, y, tile_type, dir) {
        return x >=0 && x <=3 && y >= 5 && y <= 8;
      },
      done: function () {
        draw_list.queue(sprites.tutorial1,
          configureParams.viewportRectangle[2] - 380,
          configureParams.viewportRectangle[3] - 350,
          Z_TUT + 3, color_white);
        let test = [
          [0,8,'drone',1],
          [1,5,'drone',2],
          [3,6,'drone',0],
          [1,6,'craft2',0],
          [1,8,'arrow',1],
          [2,8,'arrow',3],
        ];
        for (let ii = 0; ii < test.length; ++ii) {
          let t = test[ii];
          if (dd.map[t[0]][t[1]] && dd.map[t[0]][t[1]].type === t[2] &&
            dd.map[t[0]][t[1]].direction === t[3]
          ) {
            // good
          } else {
            return false;
          }
        }
        return true;
      },
    },
    {
      msg: [
        'You\'ve done it!',
        'Play out the turn to complete',
        'the tutorial.',
      ],
      indicator_name: 'preview',
      done: function () {
        return play_state === 'preview';
      },
    },
  ];

  const Z_TILES = 10;
  const Z_BUILD_TILE = 30;
  const Z_ACTORS = 40;
  const Z_ACTORS_CARRYING = 50;
  const Z_UI = 100;
  const Z_TUT = 150;
  const Z_FLOAT = 200;
  let view_offset = [100,100];

  const BASE_SIZE = 3;
  const TILE_SIZE = 64;
  function initGraphics() {
    if (sprites.drone) {
      return;
    }
    sprites.white = createSprite('white', {
      width : 1,
      height : 1,
      x : 0,
      y : 0,
      rotation : 0,
      color : [1,1,1, 1],
      origin: [0, 0],
      textureRectangle : mathDevice.v4Build(0, 0, 1, 1)
    });

    let spriteSize = 13;
    let background_tile = 100;
    function buildRects(w, h, sx, sy) {
      sx = sx || 1;
      sy = sy || 1;
      let rects = [];
      for (let jj = 0; jj < h; ++jj) {
        for (let ii = 0; ii < w; ++ii) {
          let r = mathDevice.v4Build(ii * spriteSize * sx, jj * spriteSize * sy, (ii + 1) * spriteSize * sx, (jj + 1) * spriteSize * sy);
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
    sprites.tutorial1 = createSprite('tutorial1.png', {
      width : TILE_SIZE * 4,
      height : TILE_SIZE * 4,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, 128, 128),
      origin: [0,0],
    });
    function loadSprite(name, tx, ty, sx, sy) {
      sprites[name] = createSprite(name + '.png', {
        width : TILE_SIZE * (sx || 1),
        height : TILE_SIZE * (sy || 1),
        rotation : 0,
        textureRectangle : mathDevice.v4Build(0, 0, spriteSize * (sx || 1), spriteSize * (sy || 1)),
        origin: [0,0],
      });
      sprites[name].rects = buildRects(tx,ty, sx, sy);
    }
    loadSprite('drone', 2, 3);
    loadSprite('arrow', 2, 2);
    loadSprite('resource', 4, 5);
    loadSprite('sell', 1, 1);
    loadSprite('green_arrow', 1, 1);
    loadSprite('upgrade_power', 1, 1);
    loadSprite('base', 1, 1, BASE_SIZE, BASE_SIZE);
    loadSprite('craft2', 2, 2, 2, 2);
    loadSprite('craft3', 2, 2, 3, 3);

    sprites.panel = glov_ui.loadSpriteRect('panel.png', [2, 12, 2], [2, 12, 2]);
  }

  const base_slurp_coords = [
    // dx, dy, destination contents index
    [-1, 0, 0],
    [0, -1, 0],
    [1, -1, 1],
    [2, -1, 2],
    [3, 0, 2],
    [3, 1, 3],
    [3, 2, 4],
    [2, 3, 4],
    [1, 3, 5],
    [0, 3, 6],
    [-1, 2, 6],
    [-1, 1, 7],
  ];
  const base_contents_coords = [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
    [1, 2],
    [0, 2],
    [0, 1],
  ];

  const craft_slurp_coords = {
    // order: UR (output), LR (2:skipped/3:input), LL (input), UL (input)
    craft2: [
      // dx, dy, destination contents index
      [1, -1, 0],
      [2, 0, 0],
      [2, 1, 1],
      [1, 2, 1],
      [0, 2, 2],
      [-1, 1, 2],
      [-1, 0, 3],
      [0, -1, 3],
    ],
    craft3:[
      [2, -1, 0],
      [3, 0, 0],
      [3, 2, 1],
      [2, 3, 1],
      [0, 3, 2],
      [-1, 2, 2],
      [-1, 0, 3],
      [0, -1, 3],
    ],
  };
  const craft_contents_coords = {
    craft2: [
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    craft3: [
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  };


  let panel_font_style = glov_font.style(null, {
    color: 0x000000ff,
    outline_width: 1.0,
    outline_color: 0xBBBBBBff,
  });
  let font_style_sale = glov_font.style(null, {
    color: 0x80FF80ff,
    outline_width: 1.0,
    outline_color: 0x000000ff,
  });
  let font_style_buy = glov_font.style(null, {
    color: 0xFF2020ff,
    outline_width: 1.0,
    outline_color: 0x000000ff,
  });
  let font_style_craft = glov_font.style(null, {
    color: 0xB0B0FFff,
    outline_width: 1.0,
    outline_color: 0x000000ff,
  });
  let font_style_hs_mine = glov_font.style(null, {
    color: 0x008000ff,
    outline_width: 1.0,
    outline_color: 0xBBBBBBff,
  });
  let font_style_hs_other = glov_font.style(null, {
    color: 0x404040ff,
    outline_width: 1.0,
    outline_color: 0xBBBBBBff,
  });


  const actor_types = { 'drone': true };
  const nonblocking_types = { 'arrow': true };
  const ticked_types = {
    'resource': true,
    'base': true,
    'craft2': true,
    'craft3': true,
  };
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];
  let VALC = 65;
  let VALS = 80;
  let VALG = 100;
  let VALD = 400;
  const resource_types = [
    null,
    {
      type: 'copper',
      tile: 0,
      quantity: 4,
      value: VALC,
    },
    {
      type: 'silver',
      tile: 1,
      quantity: 3,
      value: VALS,
    },
    {
      type: 'gold',
      tile: 2,
      quantity: 2,
      value: VALG,
    },
    {
      type: 'diamond',
      tile: 3,
      quantity: 1,
      value: VALD,
    },
  ];
  let VALCRAFT2 = 100;
  let VALCRAFT3 = 100;
  let VALSAME2 = 50;
  let VALSEQUENTIAL2 = 80;
  let VALSAME3 = 200;
  let VALSEQUENTIAL3 = 300;
  let VAL_electrum, VAL_green_gold, VAL_jewelry;
  const recipes = [
    // tile, type, value, src1, src2, ...
    [0, 'pure copper', VALC + VALC + VALCRAFT2 + VALSAME2, 'copper', 'copper'], // no significant bonus
    [1, 'pure silver', VALS + VALS + VALCRAFT2 + VALSAME2, 'silver', 'silver'],
    [2, 'pure gold', VALG + VALG + VALCRAFT2 + VALSAME2, 'gold', 'gold'],
    [6, 'sterling', VALC + VALS + VALCRAFT2 + VALSEQUENTIAL2,  'copper', 'silver'],
    [7, 'rose gold', VALC + VALG + VALCRAFT2, 'copper', 'gold'],
    [8, 'jewelry', (VAL_jewelry = VALS + VALG + VALCRAFT2 + VALSEQUENTIAL2), 'silver', 'gold'],

    [9, 'diamond ring', 2*(VALD + VAL_jewelry + VALCRAFT2 + VALSEQUENTIAL2), 'diamond', 'jewelry'],

    [10, 'copper bracelet', VALC + VALC + VALCRAFT2, 'copper', null], // copper/copper
    [11, 'copper necklace', VALC + VALC + VALC + VALCRAFT3, 'copper', null, null],
    [12, 'silver bracelet', VALS + VALC + VALCRAFT2, 'silver', null],
    [13, 'silver necklace', VALS + VALC + VALC + VALCRAFT3, 'silver', null, null],
    [14, 'gold bracelet', VALG + VALC + VALCRAFT2, 'gold', null],
    [15, 'gold necklace', VALG + VALC + VALC + VALCRAFT3, 'gold', null, null],

    [16, 'electrum', (VAL_electrum = VALC + VALS + VALG + VALCRAFT3 + VALSEQUENTIAL3), 'copper', 'silver', 'gold'],
    [17, 'green gold', (VAL_green_gold = VALS + VALG + VALG + VALCRAFT3), 'silver', 'gold', 'gold'],
    [18, 'masterpiece', 2*(VAL_electrum + VAL_green_gold + VALCRAFT2 + VALSEQUENTIAL2), 'electrum', 'green gold'],

    [4, 'junk', VALC + VALC, null, null],
    [4, 'large junk', VALC + VALC + VALC, null, null, null],
    // todo: diamonds
  ];
  function findResourceType(type) {
    for (let jj = 0; jj < resource_types.length; ++jj) {
      if (resource_types[jj] && resource_types[jj].type === type) {
        return jj;
      }
    }
    return null;
  }
  for (let ii = 0; ii < recipes.length; ++ii) {
    let line = recipes[ii];
    let type = line[1];
    if (findResourceType(ii) === null) {
      resource_types.push({
        type,
        tile: line[0],
        value: line[2],
        min: 0, max: 0, quanity: 0,
      });
    }
  }
  const cost_table = {
    'drone': [200, 100],
    'arrow': [20, 10],
    'craft2': [1000, 500],
    'craft3': [3000, 1000],
  };
  const tile_type_size = {
    'craft2': 2,
    'craft3': 3,
    'base': 3,
  };

  function resourceValue(res) {
    return resource_types[res].value;
  }
  function recipeMatch(recipe, ingred) {
    let used = [0,0,0];
    for (let ii = 3; ii < recipe.length; ++ii) {
      if (!recipe[ii]) {
        // matches anything, we're good!
        return true;
      }
      let matched = false;
      for (let jj = 0; jj < ingred.length; ++jj) {
        if (!used[jj] && resource_types[ingred[jj]].type === recipe[ii]) {
          used[jj] = true;
          matched = true;
          break;
        }
      }
      if (!matched) {
        return false;
      }
    }
    return true;
  }
  function craftResult(ingred) {
    let best = null;
    for (let ii = 0; ii < recipes.length; ++ii) {
      let r = recipes[ii];
      if (r.length - 3 !== ingred.length) {
        continue;
      }
      if ((!best || r[2] > best[2]) && recipeMatch(r, ingred)) {
        best = r;
      }
    }
    assert(best);
    return findResourceType(best[1]);
  }

  const FLOATER_TIME_CRAFT = 1800;
  const FLOATER_TIME_BASE_SALE = 1000;
  const FLOATER_TIME_BUY = 800;
  const FLOATER_SIZE = 24;
  const FLOATER_DIST = 32;
  let floaters = [];
  function floatText(x, y, time, text, style, is_ui) {
    floaters.push({
      x: x * TILE_SIZE, y: y * TILE_SIZE, z: Z_FLOAT, text, style,
      t: 0,
      time,
      is_ui,
    });
  }
  function floatTextUI(x, y, time, text, style) {
    floatText(x / TILE_SIZE, y / TILE_SIZE, time, text, style, true);
  }
  let resources_default = {
    copper: 4,
    silver: 3,
    gold: 2,
    diamond: 1,
  };

  let level_defs = [];
  if (DEBUG && false) {
    level_defs.push({
      name: 'test', seed: 'test', w: 9, h: 9,
      starting_max_power: 6,
      resources: {
        copper: 5,
      },
      goal: ['net_worth', 1100],
      starting_money: 1000,
    });
  }
  level_defs.push({
    tut: true,
    name: 'Tutorial', seed: 'na', w: 9, h: 9,
    starting_max_power: 5,
    resources: {
      gold: [[1, 4]],
      silver: [[3, 8]],
    },
    goal: ['sell', 'jewelry'],
    starting_money: 500,
  },
  {
    name: 'Level 1', seed: 'droneday4', w: 17, h: 15,
    starting_max_power: 6,
    resources: resources_default,
    goal: ['net_worth', 10000],
    starting_money: 600,
  },
  {
    name: 'Level 2', seed: 'droneday2', w: 25, h: 17,
    starting_max_power: 8,
    resources: {
      copper: 6,
      silver: 6,
      gold: 4,
      diamond: 2,
    },
    goal: ['sell', 'masterpiece'], // takes ~20k to build what sells this
    starting_money: 2000,
  });
  let ld_rand_med = {
    name: 'Random (Medium)', seed: 'rand', w: 25, h: 17,
    starting_max_power: 6,
    resources: {
      copper: 6,
      silver: 6,
      gold: 4,
      diamond: 2,
    },
    goal: [],
    starting_money: 2000,
  };
  let ld_rand_large = {
    name: 'Random (Large)', seed: 'rand', w: 49, h: 33,
    starting_max_power: 6,
    resources: {
      copper: 6*4,
      silver: 6*4,
      gold: 4*4,
      diamond: 3,
    },
    goal: [],
    starting_money: 2000,
  };

  for (let ii = 0; ii < level_defs.length; ++ii) {
    level_defs[ii].local_score = score.getScore(level_defs[ii]);
  }

  const POWER_STEP = 2;
  class DroneDayState {

    allocLevel(w, h) {
      this.map = new Array(w);
      this.busy = new Array(w);
      this.actor_map = new Array(w);
      for (let ii = 0; ii < w; ++ii) {
        this.map[ii] = new Array(h);
        this.busy[ii] = new Array(h);
        this.actor_map[ii] = new Array(h);
      }
      // Generate base in middle
      let base_x = Math.round((w - 3) / 2);
      let base_y = Math.round((h - 3) / 2);
      for (let ii = 0; ii < BASE_SIZE; ++ii) {
        for (let jj = 0; jj < BASE_SIZE; ++jj) {
          this.map[base_x + ii][base_y + jj] = {
            type: 'base',
            nodraw: true,
          };
        }
      }
      this.map[base_x][base_y].nodraw = false;
      view_offset = [
        PANEL_W + ((game_width - PANEL_W) - w * TILE_SIZE) / 2,
        (game_height - h * TILE_SIZE) / 2,
      ];
    }

    startLevel(ld) {
      this.ld = ld;
      this.tutorial_state = ld.tut ? 1 : 0;
      if (ld.tut) {
        current_tile = 'sell';
      } else {
        current_tile = 'drone';
      }

      this.turn = 0;
      this.max_power = ld.starting_max_power;
      this.money = ld.starting_money;
      let rand = random_seed.create(ld.seed || ld.name);
      this.allocLevel(ld.w, ld.h);

      // Generate resources
      let open_tiles = [];
      for (let x = 0; x < this.map.length; ++x) {
        for (let y = 0; y < this.map[x].length; ++y) {
          if (!this.map[x][y]) {
            open_tiles.push({x, y});
          }
        }
      }
      for (let ii = 0; ii < resource_types.length; ++ii) {
        let rt = resource_types[ii];
        if (!rt) {
          continue;
        }
        let count = ld.resources[rt.type];
        if (Array.isArray(count)) {
          // positions, just use them
          for (let jj = 0; jj < count.length; ++jj) {
            let pos = count[jj];
            assert(!this.map[pos[0]][pos[1]]);
            this.map[pos[0]][pos[1]] = {
              type: 'resource',
              resource: ii,
              direction: rt.tile, // just tile index, not really direction
              quantity: rt.quantity,
              base_quantity: rt.quantity,
            };
          }
        } else  {
          for (let jj = 0; jj < count; ++jj) {
            if (!open_tiles.length) {
              break;
            }
            let idx = rand(open_tiles.length);
            let pos = open_tiles[idx];
            open_tiles[idx] = open_tiles[open_tiles.length - 1];
            open_tiles.pop();
            assert(!this.map[pos.x][pos.y]);
            this.map[pos.x][pos.y] = {
              type: 'resource',
              resource: ii,
              direction: rt.tile, // just tile index, not really direction
              quantity: rt.quantity,
              base_quantity: rt.quantity,
            };
          }
        }
      }

      this.resetActors();
    }

    constructor() {
      this.tick_id = 0;
      this.turn = -1;
      this.max_power = -1;
      this.allocLevel(3,3);
      this.resetActors();
    }

    upgradeCost(type, delta) {
      assert(type === 'upgrade_power');
      let steps = (this.max_power - this.ld.starting_max_power) / POWER_STEP + delta;
      return steps * steps * 100;
    }

    netWorth() {
      let ret = this.money;
      let count = {};
      for (let ii = 0; ii < this.map.length; ++ii) {
        for (let jj = 0; jj < this.map[ii].length; ++jj) {
          let tile = this.map[ii][jj];
          if (tile && !tile.nodraw) {
            let type = tile.type;
            let cost_calc = cost_table[type];
            if (cost_calc) {
              let cc = count[type] = count[type] || 0;
              ret += cost_calc[0] + cost_calc[1] * cc;
              count[type]++;
            }
          }
        }
      }
      for (let ii = this.ld.starting_max_power; ii <= this.max_power; ii+=POWER_STEP) {
        let steps = (ii - this.ld.starting_max_power) / POWER_STEP;
        ret += steps * steps * 100;
      }
      return ret;
    }

    advanceEnd() {
      this.turn++;
      this.money += this.dmoney;
    }

    canPlaceTile(x, y, tile_type) {
      let size = tile_type_size[tile_type] || 1;
      if (x < 0 || y < 0 || x + size > this.map.length || y + size > this.map[0].length) {
        return false;
      }
      for (let ii = 0; ii < size; ++ii) {
        for (let jj = 0; jj < size; ++jj) {
          if (this.map[x + ii][y + jj]) {
            return false;
          }
        }
      }
      return true;
    }

    countOf(tile_type) {
      let r = 0;
      for (let ii = 0; ii < this.map.length; ++ii) {
        for (let jj = 0; jj < this.map[ii].length; ++jj) {
          let tile = this.map[ii][jj];
          if (tile && tile.type === tile_type && !tile.nodraw) {
            ++r;
          }
        }
      }
      return r;
    }

    costOf(tile_type, delta) {
      let cost_calc = cost_table[tile_type];
      return cost_calc[0] + cost_calc[1] * (this.countOf(tile_type) + delta - 1);
    }

    buyTile(x, y, tile_type, dir) {
      if (this.tutorial_state && tutorial_states[this.tutorial_state] && (
        !tutorial_states[this.tutorial_state].buy_validate ||
        !tutorial_states[this.tutorial_state].buy_validate(x, y, tile_type, dir)
      )) {
        floatText(x, y, 2000, 'Invalid (please follow directions)', font_style_buy);
        return;
      }
      if (x <0 || y < 0 || x >= this.map.length || y >= this.map[0].length) {
        return;
      }
      let tile = this.map[x][y];
      let dmoney = 0;
      if (!tile_type) {
        // selling
        if (tile) {
          assert(!tile.nodraw);
          let old_type = tile.type;
          let size = tile_type_size[old_type] || 1;
          for (let ii = 0; ii < size; ++ii) {
            for (let jj = 0; jj < size; ++jj) {
              this.map[x + ii][y + jj] = null;
            }
          }
          dmoney = this.costOf(old_type, 1);
        }
      } else {
        if (tile && tile.type === tile_type) {
          // just rotate
          tile.direction = (tile.direction + 1) % 4;
        } else {
          dmoney = -this.costOf(tile_type, 1);
          if (-dmoney > this.money) {
            floatText(x, y, FLOATER_TIME_BUY, `Cannot afford \$${-dmoney}`, font_style_buy);
            dmoney = 0;
          } else {
            // place new tile(s)
            let size = tile_type_size[tile_type] || 1;
            for (let ii = 0; ii < size; ++ii) {
              for (let jj = 0; jj < size; ++jj) {
                tile = this.map[x + ii][y + jj] = {
                  type: tile_type,
                  direction: dir,
                  nodraw: ii !== 0 || jj !== 0,
                };
              }
            }
          }
        }
      }
      if (dmoney) {
        floatText(x, y, FLOATER_TIME_BUY, `${(dmoney < 0) ? '-' : '+'}\$${Math.abs(dmoney)}`, (dmoney > 0) ? font_style_sale : font_style_buy);
        this.money += dmoney;
      }
    }

    resetActors() {
      this.goal_reached = false;
      this.resource_transfers = [];
      this.craftings = [];
      this.tickers = [];
      this.actors = [];
      for (let ii = 0; ii < this.actor_map.length; ++ii) {
        for (let jj = 0; jj < this.actor_map[ii].length; ++jj) {
          this.actor_map[ii][jj] = null;
        }
      }
      this.dmoney = 0;
      for (let x = 0; x < this.map.length; ++x) {
        for (let y = 0; y < this.map[x].length; ++y) {
          let tile = this.map[x][y];
          if (!tile) {
            continue;
          }
          if (tile.type === 'resource') {
            tile.quantity = tile.base_quantity;
          } else {
            if (!tile.nodraw) {
              // upper left corner of base, crafting, etc
              tile.contents = null;
            }
          }
        }
      }
      this.power = this.max_power;
    }

    initActors() {
      this.resetActors();
      let actors = this.actors = [];
      let tickers = [];
      for (let y = 0; y < this.map[0].length; ++y) {
        for (let x = 0; x < this.map.length; ++x) {
          let tile = this.map[x][y];
          if (!tile) {
            continue;
          }
          if (actor_types[tile.type]) {
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
          } else if (ticked_types[tile.type]) {
            if (tile.type === 'resource') {
              tickers.push({ x, y, tile });
            } else {
              if (!tile.nodraw) {
                // upper left corner of base, crafting, etc
                tickers.push({ x, y, tile });
              }
            }
          }
        }
      }
      // tick bases before craft3 before craft2 before resources
      let tick_order = ['base', 'craft3', 'craft2', 'resource'];
      let tickers_out = tick_order.map(function() { return []; });
      for (let ii = 0; ii < tickers.length; ++ii) {
        let idx = tick_order.indexOf(tickers[ii].tile.type);
        assert(idx !== -1);
        tickers_out[idx].push(tickers[ii]);
      }
      this.tickers = [];
      tickers_out.forEach((arr) => {
        this.tickers = this.tickers.concat(arr);
      });
    }

    getActor(x, y) {
      if (x < 0 || y < 0 || x >= this.map.length || y >= this.map[0].length) {
        // out of bounds
        return null;
      }
      return this.actor_map[x][y];
    }

    tickResource(ticker) {
      let tile = ticker.tile;
      if (!tile.quantity || this.power <= 0) {
        return;
      }
      for (let ii = 0; ii < dx.length; ++ii) {
        let target_x = ticker.x + dx[ii];
        let target_y = ticker.y + dy[ii];
        let target_actor = this.getActor(target_x, target_y);
        if (!target_actor || target_actor.gain_resource_tick === this.tick_id) {
          continue;
        }
        if (!target_actor.carrying) {
          target_actor.carrying = tile.resource;
          this.resource_transfers.push([tile.resource, ticker.x, ticker.y, target_x, target_y]);
          target_actor.gain_resource_tick = this.tick_id;
          --tile.quantity;
          if (!tile.quantity) {
            break;
          }
        }
      }
    }

    tickBase(ticker) {
      let tile = ticker.tile;

      // First, sell off contents
      if (tile.contents) {
        for (let ii = 0; ii < tile.contents.length; ++ii) {
          if (tile.contents[ii]) {
            let res = tile.contents[ii];
            let resource_value = resourceValue(res);
            this.dmoney += resource_value;
            tile.contents[ii] = null;
            floatText((ticker.x + base_contents_coords[ii][0]), (ticker.y + base_contents_coords[ii][1]),
              FLOATER_TIME_BASE_SALE, `${resource_types[res].type}: +\$${resource_value}`, font_style_sale);
            if (this.ld.goal[0] === 'sell' && this.ld.goal[1] === resource_types[res].type) {
              this.goal_reached = true;
            }
          }
        }
      }

      if (this.power <= 0) {
        return;
      }
      for (let jj = 0; jj < base_slurp_coords.length; ++jj) {
        let target_contents = base_slurp_coords[jj][2];
        if (tile.contents && tile.contents[target_contents]) {
          // already full
          continue;
        }
        let target_x = ticker.x + base_slurp_coords[jj][0];
        let target_y = ticker.y + base_slurp_coords[jj][1];
        let target_actor = this.getActor(target_x, target_y);
        if (!target_actor || target_actor.gain_resource_tick === this.tick_id) {
          continue;
        }
        if (target_actor.carrying) {
          tile.contents = tile.contents || [];
          tile.contents[target_contents] = target_actor.carrying;
          this.resource_transfers.push([target_actor.carrying, target_x, target_y,
            ticker.x + base_contents_coords[target_contents][0], ticker.y + base_contents_coords[target_contents][1]]);
          target_actor.carrying = null;
          target_actor.gain_resource_tick = this.tick_id;
        }
      }
    }

    tickCraft(ticker) {
      let tile = ticker.tile;
      // First attempt to construct new contents
      if (tile.contents && !tile.contents[0]) {
        let index0 = 1;
        if (tile.type === 'craft2') {
          index0 = 2;
        }
        let full = true;
        for (let ii = index0; ii < 4; ++ii) {
          if (!tile.contents[ii]) {
            full = false;
          }
        }
        if (full) {
          // craft!
          let ingred = tile.contents.slice(index0);
          let res = craftResult(ingred);
          let message = [];
          let orig_val = 0;
          this.craftings.push({
            x: ticker.x,
            y: ticker.y,
            ingred,
            res,
            tile,
          });
          for (let ii = index0; ii < 4; ++ii) {
            message.push(resource_types[tile.contents[ii]].type);
            orig_val += resource_types[tile.contents[ii]].value;
            tile.contents[ii] = null;
          }
          tile.contents[0] = res;
          let new_value = resource_types[res].value;
          let delta = new_value - orig_val;
          floatText(ticker.x, ticker.y, FLOATER_TIME_CRAFT,
            message.join(' + ') + ': ' + resource_types[res].type +
            ` (${( delta >= 0) ? '+' : '-'}\$${Math.abs(delta)})`,
            font_style_craft);
        }
      }
      if (this.power <= 0) {
        return;
      }

      // attempt to spread output, slurp input
      let slurp_coords = craft_slurp_coords[tile.type];
      let contents_coords = craft_contents_coords[tile.type];
      for (let jj = 0; jj < slurp_coords.length; ++jj) {
        let target_contents = (slurp_coords[jj][2] + 4 - tile.direction) % 4;
        if (tile.type === 'craft2' && target_contents === 1) {
          // does not exist
          continue;
        }
        let is_out = target_contents === 0;
        if (is_out && (!tile.contents || !tile.contents[0])) {
          // output, and we have no contents, skip
          continue;
        }
        if (!is_out && tile.contents && tile.contents[target_contents]) {
          //input and we're full
          continue;
        }
        // look for actor
        let target_x = ticker.x + slurp_coords[jj][0];
        let target_y = ticker.y + slurp_coords[jj][1];
        let target_actor = this.getActor(target_x, target_y);
        if (!target_actor || target_actor.gain_resource_tick === this.tick_id) {
          continue;
        }
        let target_content_x = ticker.x + contents_coords[slurp_coords[jj][2]][0];
        let target_content_y = ticker.y + contents_coords[slurp_coords[jj][2]][1];
        if (is_out && !target_actor.carrying) {
          // output
          target_actor.carrying = tile.contents[target_contents];
          this.resource_transfers.push([target_actor.carrying, target_content_x, target_content_y, target_x, target_y]);
          target_actor.gain_resource_tick = this.tick_id;
          tile.contents[target_contents] = null;
        } else if (!is_out && target_actor.carrying) {
          // input
          tile.contents = tile.contents || [];
          tile.contents[target_contents] = target_actor.carrying;
          this.resource_transfers.push([target_actor.carrying, target_x, target_y, target_content_x, target_content_y]);
          target_actor.carrying = null;
          target_actor.gain_resource_tick = this.tick_id;
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
      actor.last_carrying = actor.carrying;
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

    tickTicker(ticker) {
      switch(ticker.tile.type) {
      case 'resource':
        this.tickResource(ticker);
        break;
      case 'base':
        this.tickBase(ticker);
        break;
      case 'craft2':
      case 'craft3':
        this.tickCraft(ticker);
        break;
      }
    }

    tick() {
      ++this.tick_id;
      this.resource_transfers = [];
      this.craftings = [];
      for (let ii = 0; ii < this.busy.length; ++ii) {
        for (let jj = 0; jj < this.busy[ii].length; ++jj) {
          this.busy[ii][jj] = 0;
        }
      }
      // Determine where we want to move to prevent collisions
      // Set last_*
      for (let ii = 0; ii < this.actors.length; ++ii) {
        this.tickActorEarly(this.actors[ii]);
      }
      if (this.power > 0) {
        // Do movement, do turning
        for (let ii = 0; ii < this.actors.length; ++ii) {
          this.tickActor(this.actors[ii]);
        }
      }
      // Move resources around
      // When out of power, only sell things on base
      for (let ii = 0; ii < this.tickers.length; ++ii) {
        this.tickTicker(this.tickers[ii]);
      }
      --this.power;

      if (this.power < 0) {
        if (this.ld.goal[0] === 'net_worth') {
          if (this.netWorth() + this.dmoney >= this.ld.goal[1]) {
            this.goal_reached = true;
          }
        }
      }
    }
  }

  const ADVANCE_SPEED = 1000;
  const ADVANCE_SPEED_FAST = 200;

  let dd;
  let current_tile;
  let current_direction;
  let play_state;
  let recipes_page = 0;
  let tick_time;
  let tick_countdown;

  function playInit(dt) {
    $('#canvas').focus();
    initGraphics();
    $('.screen').hide();
    $('#play').show();
    game_state = play;
    dd = new DroneDayState();
    current_direction = 2;
    if (DEBUG) {
      dd.startLevel(level_defs[2]);
      play_state = 'build';
    } else {
      play_state = 'menu';
    }
    floaters = [];

    if (DEBUG) {
      // dd.buyTile(2, 3, 'drone', 2);

      // dd.buyTile(2, 4, 'arrow', 1);



      // dd.buyTile(10, 3, 'drone', 2);
      // dd.buyTile(10, 4, 'drone', 0);

      // dd.buyTile(5, 2, 'drone', 1);
      // dd.buyTile(6, 4, 'drone', 0);
      // dd.buyTile(8, 3, 'drone', 3);


      // dd.buyTile(11, 2, 'drone', 1);
      // dd.buyTile(12, 4, 'drone', 0);
      // dd.buyTile(13, 1, 'drone', 2);
      // dd.buyTile(14, 3, 'drone', 3);
      // dd.buyTile(12, 2, 'arrow', 1);
      // dd.buyTile(12, 3, 'arrow', 0);
      // dd.buyTile(13, 2, 'arrow', 2);
      // dd.buyTile(13, 3, 'arrow', 3);

      // dd.buyTile(4, 10, 'drone', 2);
      // dd.buyTile(4, 12, 'drone', 0);

      // dd.buyTile(5, 7, 'drone', 1);
      // dd.buyTile(7, 3, 'drone', 2);
      // dd.buyTile(6, 7, 'arrow', 2);
      // dd.buyTile(6, 8, 'craft2', 1);
      // dd.buyTile(8, 9, 'arrow', 1);
      // dd.buyTile(9, 9, 'arrow', 3);
      // dd.buyTile(8, 10, 'drone', 0);

      // previewStart();
    } else {
      dd.buyTile(7, 7, 'drone', 0);
      dd.buyTile(7, 6, 'arrow', 1);
      dd.buyTile(8, 6, 'arrow', 3);

      dd.buyTile(9, 3, 'drone', 2);
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
    draw_list.queue(s, x * TILE_SIZE + view_offset[0], y * TILE_SIZE + view_offset[1], z, color, null, tex_rect);
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
    tick_time = ADVANCE_SPEED;
    tick_countdown = 0.01;
    dd.initActors();
  }
  function previewEnd() {
    play_state = 'build';
    dd.resetActors();
  }
  function advanceEnd() {
    dd.advanceEnd();
    play_state = 'build';
    if (dd.goal_reached) {
      score.setScore(dd.ld, dd.turn, dd.netWorth());
      play_state = 'menu';
    }
    dd.resetActors();
  }

  const store = [
    {
      type: 'drone',
      display_name: 'Drone',
      tooltip: [
        'Drones pick up and',
        'drop off resources.',
        'Deliver to your',
        'base to earn money.',
      ],
    },
    {
      type: 'arrow',
      display_name: 'Turn',
      tooltip: [
        'Arrows change the',
        'direction of a Drone when',
        'they travel over them.',
        'Click multiple times',
        'to rotate while',
        'placing.',
      ],
    },
    {
      type: 'craft2',
      display_name: '2-Node Crafting Station',
      tooltip: [
        'Crafting Stations combine',
        'resources into more',
        'advanced resources.',
      ]
    },
    {
      type: 'craft3',
      display_name: '3-Node Crafting Station',
    },
    {
      type: 'sell',
      display_name: 'Sell',
      tooltip: [
        'Sell placed items for',
        'a full refund.',
        '',
        'Hotkey: Shift-Click',
        'Hotkey: Right Click',
      ]
    },
  ];
  store[3].tooltip = store[2].tooltip.slice(0);
  for (let ii = 0; ii < store.length; ++ii) {
    let cost_calc = cost_table[store[ii].type];
    if (cost_calc) {
      store[ii].tooltip.push('',
        `Base Cost: \$${cost_calc[0]}`,
        `Delta Cost: \$${cost_calc[1]}`);
    }
    store[ii].tooltip.push(`Hotkey: ${ii + 1}`);
  }
  const upgrades = [
    {
      type: 'upgrade_power',
    }
  ];

  function drawPanel(x, y, z, w, h) {
    glov_ui.drawBox(sprites.panel, x, y, z, w, h, 80, [1,1,0.8,1]);
    input.clickHit(x, y, w, h);
    input.isMouseOver(x, y, w, h);
  }

  function drawResource(x, y, tile) {
    let s = sprites.resource;
    let tex_rect = s.rects[tile];
    draw_list.queue(s, x, y, Z_UI, color_white, null, tex_rect);
  }

  const PANEL_W = 200;
  const TOOLTIP_FONT_SIZE = 24;
  const TOOLTIP_W = 300;
  function buttonTooltip(x, y, z, w, h, img, img_rect, tooltip_x, tooltip) {
    let ret = false;
    if (glov_ui.buttonImage(x, y, z, w, h, img, img_rect)) {
      ret = true;
    }
    if (glov_ui.button_mouseover) {
      let tx = tooltip_x + 16;
      let ty = y + 8;
      if (tooltip) {
        for (let ii = 0; ii < tooltip.length; ++ii) {
          default_font.drawSized(panel_font_style, tx, ty, z + 2, TOOLTIP_FONT_SIZE, TOOLTIP_FONT_SIZE, tooltip[ii]);
          ty += TOOLTIP_FONT_SIZE;
        }
        drawPanel(tooltip_x, y, z + 1, TOOLTIP_W, ty - y + 8);
      }
    }
    return ret;
  }

  let panning_active = false;
  let panning_lastpos = null;
  let panning_start = null;
  function doPanning() {
    if (!dd.ld || dd.ld.tut) {
      return;
    }
    let pan = input.isKeyDown(keyCodes.SPACE) || input.isMouseDown(0) || input.isMouseDown(1) || input.isMouseDown(2);
    if (pan && !panning_active) {
      panning_active = true;
      panning_start = panning_lastpos = input.mousePos();
    } else if (!pan && panning_active) {
      panning_active = false;
      panning_lastpos = null;
      let newpos = input.mousePos();
      let delta = [newpos[0] - panning_start[0], newpos[1] - panning_start[1]];
      if (Math.abs(delta[0]) + Math.abs(delta[1]) > 20) {
        input.clickHit(-Infinity, -Infinity, Infinity, Infinity);
      }
    } else if (pan) {
      let newpos = input.mousePos();
      let delta = [newpos[0] - panning_lastpos[0], newpos[1] - panning_lastpos[1]];
      panning_lastpos = newpos;
      view_offset[0] += delta[0];
      view_offset[1] += delta[1];
    }
  }

  function tooltipOver(x, y, tooltip) {
    let tx = x + 16;
    let h = 8 + tooltip.length * TOOLTIP_FONT_SIZE + 8;
    let ty0 = y - h;
    let ty = ty0 + 8;
    for (let ii = 0; ii < tooltip.length; ++ii) {
      default_font.drawSized(panel_font_style, tx, ty, Z_UI + 2, TOOLTIP_FONT_SIZE, TOOLTIP_FONT_SIZE, tooltip[ii]);
      ty += TOOLTIP_FONT_SIZE;
    }
    drawPanel(x, ty0, Z_UI+1, TOOLTIP_W, h);
  }

  let money_x, money_y;
  let sell_clicks = 0;
  let show_recipes = false;
  let auto_started_tut = false;
  function play(dt) {
    indicator_pos.next_turn = null;
    const BUTTON_H = 64;
    const BUTTON_W = 320;
    const BUTTON_W_BUY = 64 + 20;
    const BUTTON_H_BUY = 64 + 20;
    const COST_FONT_SIZE = 26;
    const COST_FONT_PAD = (BUTTON_H_BUY - COST_FONT_SIZE) / 2;
    const UI_BOTTOM = configureParams.viewportRectangle[3];
    const UI_SIDE = configureParams.viewportRectangle[0];
    const UI_RIGHT = configureParams.viewportRectangle[2];
    const TOOLTIP_X = UI_SIDE + PANEL_W;
    let status = '';
    let button_bottom_count = 0;
    if (play_state === 'build') {
      // Bottom UI
      indicator_pos.preview = { x: BUTTON_W / 2, y: UI_BOTTOM - BUTTON_H};
      if (glov_ui.buttonText(0, UI_BOTTOM - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H, 'Preview')) {
        if (dd.tutorial_state && tutorial_states[dd.tutorial_state] && tutorial_states[dd.tutorial_state].indicator_name !== 'preview') {
          floatTextUI(0, UI_BOTTOM - BUTTON_H, 2000, 'Invalid (please follow directions)', font_style_buy);
        } else {
          previewStart();
        }
      }
      if (glov_ui.button_mouseover) {
        tooltipOver((BUTTON_W + 4) * button_bottom_count, UI_BOTTOM - BUTTON_H, [
          'Unleash the drones!',
          'Do not worry, you can',
          'return and make',
          'adjustments before',
          'ending your turn.',
        ]);
      }
      ++button_bottom_count;

      if (glov_ui.buttonText(game_width - BUTTON_W, UI_BOTTOM - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H,
        'Menu')
      ) {
        play_state = 'menu';
      }

      // Top UI
      let TOP_W = 500;
      let TOP_X = PANEL_W + (game_width - PANEL_W - TOP_W) / 2;
      let top_y0 = configureParams.viewportRectangle[1];
      let top_y = top_y0;
      const TOP_FONT_SIZE = 28;
      default_font.drawAlignedSized(panel_font_style, TOP_X, top_y, Z_UI, TOP_FONT_SIZE, TOP_FONT_SIZE,
        glov_font.ALIGN.HCENTER, TOP_W, 0, `Level: ${dd.ld.name}`);
      top_y += TOP_FONT_SIZE;
      if (dd.ld.goal[0] === 'sell') {
        default_font.drawAlignedSized(panel_font_style, TOP_X, top_y, Z_UI, TOP_FONT_SIZE, TOP_FONT_SIZE,
          glov_font.ALIGN.HCENTER, TOP_W, 0, `Goal: Craft and Sell 1 ${dd.ld.goal[1]}`);
        top_y += TOP_FONT_SIZE;
      } else if (dd.ld.goal[0] === 'net_worth') {
        default_font.drawAlignedSized(panel_font_style, TOP_X, top_y, Z_UI, TOP_FONT_SIZE, TOP_FONT_SIZE,
          glov_font.ALIGN.HCENTER, TOP_W, 0, `Goal: Net Worth of \$${dd.ld.goal[1]}`);
        top_y += TOP_FONT_SIZE;
      }
      default_font.drawAlignedSized(panel_font_style, TOP_X, top_y, Z_UI, TOP_FONT_SIZE * 0.8, TOP_FONT_SIZE * 0.8,
        glov_font.ALIGN.HCENTER, TOP_W, 0,
        `Current Net Worth: \$${dd.netWorth()}`);
      top_y += TOP_FONT_SIZE * 0.8;
      top_y += 12;
      drawPanel(TOP_X, top_y0 - 100, Z_UI-1,
        TOP_W, top_y - top_y0 + 100);

      // Side UI
      let x = UI_SIDE + 14;
      let y = 10;
      let font_size = 28;
      let pad = 8;

      money_x = x + default_font.getStringWidth(panel_font_style, font_size, 'Money: ');
      money_y = y + 12;
      default_font.drawSized(panel_font_style, x, y, Z_UI, font_size, font_size,
        `Money: \$${dd.money}`);
      y += font_size + pad;

      default_font.drawSized(panel_font_style, x, y, Z_UI, font_size, font_size,
        'Build:');
      y += font_size + pad;

      let tools_w = 1;
      let bx = x;
      for (let ii = 0; ii < store.length; ++ii) {
        let tile = 2;
        if (current_tile === store[ii].type) {
          tile = current_direction;
        }
        indicator_pos['buy_' + store[ii].type] = { x: bx + BUTTON_H_BUY / 2, y: y + 16 };
        if (buttonTooltip(bx, y, Z_UI, BUTTON_W_BUY, BUTTON_H_BUY, sprites[store[ii].type], sprites[store[ii].type].rects[tile], TOOLTIP_X, store[ii].tooltip) ||
          input.keyDownHit(keyCodes['NUMBER_' + (1 + ii)])
        ) {
          if (current_tile === store[ii].type && current_tile !== 'sell') {
            current_direction = (current_direction + 1) % 4;
          } else {
            current_tile = store[ii].type;
            current_direction = 2;
          }
          if (current_tile === 'sell') {
            ++sell_clicks;
            if (sell_clicks === 6) {
              floatTextUI(bx, y, 3000, 'TIP: Use Right Click or Shift-Click for quicker selling!', font_style_buy);
              sell_clicks = 0;
            }
          }
        }

        if (tools_w === 1 && store[ii].type !== 'sell') {
          let cost = dd.costOf(store[ii].type, 1);
          default_font.drawSized(panel_font_style, x + BUTTON_W_BUY + 8, y + COST_FONT_PAD, Z_UI, COST_FONT_SIZE, COST_FONT_SIZE,
            `\$${cost}`);
        }

        if (ii % tools_w === (tools_w - 1) || ii === store.length - 1) {
          bx = x;
          y += BUTTON_H_BUY + 2;
        } else {
          bx += BUTTON_W_BUY + 2;
        }
      }

      y += pad;

      default_font.drawSized(panel_font_style, x, y, Z_UI, font_size, font_size,
        'Upgrade:');
      y += font_size + pad;

      const ICON_UPGRADE_SIZE = 64;
      const BUTTON_UPGRADE_SIZE = 32;
      const UPGRADE_FONT_PAD = (BUTTON_UPGRADE_SIZE - COST_FONT_SIZE) / 2;
      for (let ii = 0; ii < upgrades.length; ++ii) {
        let ugt = upgrades[ii].type;

        default_font.drawSized(panel_font_style, x, y, Z_UI, font_size, font_size,
          'Drone Power');
        y += font_size + pad;

        draw_list.queue(sprites[ugt], x, y, Z_UI, color_white);

        /* jshint bitwise:false*/
        default_font.drawAlignedSized(panel_font_style, x, y, Z_UI + 1, font_size, font_size,
          glov_font.ALIGN.HCENTER | glov_font.ALIGN.VCENTER, ICON_UPGRADE_SIZE, ICON_UPGRADE_SIZE, `${dd.max_power}`);

        let cost_up = dd.upgradeCost(ugt, 1);
        default_font.drawSized(panel_font_style, x + ICON_UPGRADE_SIZE + 8 + 32 + 8, y + UPGRADE_FONT_PAD, Z_UI, COST_FONT_SIZE, COST_FONT_SIZE,
          `\$${cost_up}`);
        let cost_down = dd.upgradeCost(ugt, 0);
        if (cost_down) {
          default_font.drawSized(panel_font_style, x + ICON_UPGRADE_SIZE + 8 + 32 + 8, y + BUTTON_UPGRADE_SIZE + UPGRADE_FONT_PAD, Z_UI, COST_FONT_SIZE, COST_FONT_SIZE,
            `\$${cost_down}`);
        }

        if (cost_up <= dd.money && glov_ui.buttonText(x + ICON_UPGRADE_SIZE + 8, y, Z_UI, BUTTON_UPGRADE_SIZE, BUTTON_UPGRADE_SIZE, '+')) {
          dd.max_power+=POWER_STEP;
          dd.money -= cost_up;
          floatTextUI(money_x, money_y, FLOATER_TIME_BUY, `-\$${cost_up}`, font_style_buy);
          floatTextUI(x, y + ICON_UPGRADE_SIZE / 2 , FLOATER_TIME_BUY, `+${POWER_STEP} Power`, font_style_sale);
        }
        if (cost_down && glov_ui.buttonText(x + ICON_UPGRADE_SIZE + 8, y + ICON_UPGRADE_SIZE - BUTTON_UPGRADE_SIZE, Z_UI, BUTTON_UPGRADE_SIZE, BUTTON_UPGRADE_SIZE, '-')) {
          dd.max_power-=POWER_STEP;
          dd.money += cost_down;
          floatTextUI(money_x, money_y, FLOATER_TIME_BUY, `+\$${cost_down}`, font_style_sale);
          floatTextUI(x, y + ICON_UPGRADE_SIZE / 2, FLOATER_TIME_BUY, `-${POWER_STEP} Power`, font_style_buy);
        }

        y += ICON_UPGRADE_SIZE + pad;
      }

      y += pad;

      drawPanel(UI_SIDE - 64, 0, Z_UI - 1, PANEL_W + 64, y);

      if (dd.dmoney) {
        status = `Turn ${dd.turn + 1}; Last turn earnings: \$${dd.dmoney}`;
      } else {
        status = `Turn ${dd.turn + 1}`;
      }

      if (input.keyDownHit(keyCodes.TAB)) {
        if (current_tile === 'drone') {
          current_tile = 'arrow';
        } else {
          current_tile = 'drone';
        }
      }
    } else if (play_state === 'preview') {
      let efftick_time = tick_time;
      if (input.isKeyDown(keyCodes.F) || input.isKeyDown(keyCodes.LEFT_SHIFT) || input.isKeyDown(keyCodes.RIGHT_SHIFT)) {
        efftick_time = ADVANCE_SPEED_FAST;
      }
      let effdt = dt / efftick_time;
      if (effdt >= tick_countdown) {
        dd.tick();
        let dtr = effdt - tick_countdown;
        tick_countdown = Math.max(0.5, 1 - dtr);
      } else {
        tick_countdown -= effdt;
      }

      // draw power bar
      const POWER_BAR_W = 100;
      const POWER_BAR_H = game_height - BUTTON_H * 2;
      glov_ui.drawBox(sprites.panel, UI_RIGHT - POWER_BAR_W, BUTTON_H, Z_UI, POWER_BAR_W, POWER_BAR_H,
        64, [0.5,0,0,1]);
      const power_left = Math.max(0, (dd.power + easeIn(tick_countdown, 2)) / dd.max_power);
      if (power_left * POWER_BAR_H > 16) {
        let bar_y = BUTTON_H + POWER_BAR_H * (1 - power_left);
        glov_ui.drawBox(sprites.panel, UI_RIGHT - POWER_BAR_W, bar_y, Z_UI + 1, POWER_BAR_W, POWER_BAR_H * power_left,
          64, [0,1,0,1]);
        if (dd.power) {
          default_font.drawAlignedSized(null, UI_RIGHT - POWER_BAR_W, bar_y + 8, Z_UI + 2, 64, 64, glov_font.ALIGN.HCENTER,
            POWER_BAR_W, 0, `${dd.power}`);
        }
      }

      if (glov_ui.buttonText((BUTTON_W + 4) * button_bottom_count, UI_BOTTOM - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H,
        (dd.power < 0) ? 'Back to Build' : 'Cancel')
      ) {
        previewEnd();
      }
      if (glov_ui.button_mouseover) {
        tooltipOver((BUTTON_W + 4) * button_bottom_count, UI_BOTTOM - BUTTON_H, [
          'Return to building,',
          'gaining nothing,',
          'but not wasting a',
          'turn.',
        ]);
      }

      ++button_bottom_count;

      if (dd.power < 0) {
        indicator_pos.next_turn = { x: game_width - BUTTON_W +  BUTTON_W / 2, y: UI_BOTTOM - BUTTON_H};
        if (glov_ui.buttonText(game_width - BUTTON_W, UI_BOTTOM - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H,
          dd.goal_reached ? 'Victory!' : 'Next Turn')
        ) {
          advanceEnd();
          floatTextUI(money_x, money_y, FLOATER_TIME_BUY, `+\$${dd.dmoney}`, font_style_sale);
        }
        if (glov_ui.button_mouseover) {
          tooltipOver(game_width - TOOLTIP_W, UI_BOTTOM - BUTTON_H, dd.goal_reached ?
          [
            'You have accomplished',
            'this level\'s goals!',
            'Click to return to',
            'level selection.',
          ] :
          [
            'Collect your earnings',
            `(\$${dd.dmoney}) and start`,
            'your next turn.'
          ]);
        }
      } else {
        if (glov_ui.buttonText(game_width - BUTTON_W, UI_BOTTOM - BUTTON_H, Z_UI, BUTTON_W, BUTTON_H,
          (tick_time === ADVANCE_SPEED) ? 'Speed: Regular' : 'Speed: Fast')
        ) {
          tick_time = (tick_time === ADVANCE_SPEED) ? ADVANCE_SPEED_FAST : ADVANCE_SPEED;
        }
        if (glov_ui.button_mouseover) {
          tooltipOver(game_width - TOOLTIP_W, UI_BOTTOM - BUTTON_H, [
            'Toggle simulation speed',
            'between fast and regular.',
            'You may also hold SHIFT',
            'or F to go Fast.',
          ]);
        }
      }

      status = `Turn ${dd.turn + 1} Earnings: \$${dd.dmoney}`;
    } else if (play_state === 'menu') {
      score.updateHighScores(level_defs);
      const MENU_W = 900;
      const MENU_X = (game_width - MENU_W) / 2;
      const MENU_Y = 100;
      const MENU_FONT_SIZE1 = 48;
      const MENU_FONT_SIZE2 = 32;
      let x = MENU_X;
      let y = MENU_Y + 8;

      default_font.drawAlignedSized(panel_font_style, x, y, Z_UI, MENU_FONT_SIZE1, MENU_FONT_SIZE1,
        glov_font.ALIGN.HCENTER, MENU_W, 0,
        'Drone Supervisor');
      y += MENU_FONT_SIZE1;

      default_font.drawAlignedSized(panel_font_style, x, y, Z_UI, MENU_FONT_SIZE2, MENU_FONT_SIZE2,
        glov_font.ALIGN.HCENTER, MENU_W, 0,
        'Ludum Dare #39 Entry by Jimbly');
      y += MENU_FONT_SIZE2;

      y += 16;

      const SCORE_W = 200;
      const SCORE_X = x + 400;
      const SCORE_HIGH_X = SCORE_X + SCORE_W;
      const SCORE_HIGH_W = MENU_X + MENU_W - SCORE_HIGH_X - 16;
      const MENU_BUTTON_W = BUTTON_W;
      const LEVEL_X = SCORE_X - MENU_BUTTON_W - 16;
      const SCORE_SIZE = MENU_FONT_SIZE2;
      default_font.drawSized(panel_font_style, SCORE_X, y, Z_UI, SCORE_SIZE, SCORE_SIZE,
        'Score');
      default_font.drawSized(panel_font_style, SCORE_HIGH_X, y, Z_UI, SCORE_SIZE, SCORE_SIZE,
        'High Score');
      y += SCORE_SIZE;
      let score_total = { turns: 0, net_worth: 0 };
      let all_done = true;
      for (let ii = 0; ii < level_defs.length; ++ii) {
        let ld = level_defs[ii];
        if (glov_ui.buttonText(LEVEL_X, y, Z_UI, MENU_BUTTON_W, BUTTON_H, ld.name)) {
          dd.startLevel(ld);
          play_state = 'build';
        }

        // Score
        default_font.drawAlignedSized(panel_font_style, SCORE_X, y + (BUTTON_H - SCORE_SIZE) / 2 - 4, Z_UI, SCORE_SIZE, SCORE_SIZE,
          glov_font.ALIGN.HFIT, SCORE_W - 16, 0,
          ld.local_score ? score.formatScore(ld.local_score) : 'incomplete');
        if (ld.local_score) {
          score_total.turns += ld.local_score.turns;
          score_total.net_worth += ld.local_score.net_worth;
        } else {
          all_done = false;
        }

        // High score
        let high_score = score.high_scores[ld.name];
        high_score = high_score && high_score[0];
        if (high_score) {
          let mine = ld.local_score && high_score.score.turns === ld.local_score.turns && high_score.score.net_worth === ld.local_score.net_worth;
          default_font.drawAlignedSized(mine ? font_style_hs_mine : font_style_hs_other,
            SCORE_HIGH_X, y + (BUTTON_H - SCORE_SIZE) / 2 - 4, Z_UI, SCORE_SIZE, SCORE_SIZE,
            glov_font.ALIGN.HFIT, SCORE_HIGH_W - 16, 0,
            score.formatName(high_score) + ' ' + score.formatScore(high_score.score));
        }

        y += BUTTON_H - 8;
        if (glov_ui.buttonText(SCORE_HIGH_X, y, Z_UI, SCORE_HIGH_W, BUTTON_H, 'View Scores')) {
          viewScoresInit(ld.name);
        }
        y += BUTTON_H + 4;
      }
      default_font.drawAlignedSized(panel_font_style, LEVEL_X, y, Z_UI, SCORE_SIZE, SCORE_SIZE,
        glov_font.ALIGN.HCENTER, MENU_BUTTON_W, 0, 'Total Score');
      default_font.drawSized(panel_font_style, SCORE_X, y, Z_UI, SCORE_SIZE, SCORE_SIZE,
        all_done ?
        score.formatScore(score_total) :
        'incomplete');
      y += SCORE_SIZE;
      y += 12;

      if (!DEBUG && !score_total.turns && !auto_started_tut) {
        auto_started_tut = true;
        dd.startLevel(level_defs[0]);
        play_state = 'build';
      }

      if (glov_ui.buttonText(LEVEL_X, y, Z_UI, MENU_BUTTON_W + 150, BUTTON_H, 'Random (Medium)')) {
        ld_rand_med.seed = Math.random();
        dd.startLevel(ld_rand_med);
        play_state = 'build';
      }
      y += BUTTON_H + 4;
      if (glov_ui.buttonText(LEVEL_X, y, Z_UI, MENU_BUTTON_W + 150, BUTTON_H, 'Random (Large)')) {
        ld_rand_large.seed = Math.random();
        dd.startLevel(ld_rand_large);
        play_state = 'build';
      }
      y += BUTTON_H + 4;


      y += 16;
      if (glov_ui.buttonText(x + 16, y, Z_UI, MENU_BUTTON_W, BUTTON_H, 'Recipes')) {
        play_state = 'recipes';
        recipes_page = 0;
      }
      y += BUTTON_H + 4;

      if (dd.map.length > 3) {
        if (glov_ui.buttonText(x + 16, y, Z_UI, MENU_BUTTON_W, BUTTON_H, 'Back')) {
          play_state = 'build';
        }
        y += BUTTON_H;
      }

      y += 8;

      drawPanel(MENU_X, MENU_Y, Z_UI - 1, MENU_W, y - MENU_Y);

      draw_list.queue(sprites.white, configureParams.viewportRectangle[0], configureParams.viewportRectangle[1], Z_UI - 2, [0,0,0,0.9],
        [configureParams.viewportRectangle[2] - configureParams.viewportRectangle[0], configureParams.viewportRectangle[3] - configureParams.viewportRectangle[1], 1, 1]);
    } else if (play_state === 'recipes') {

      let x = 0;
      let w = game_width;
      let y = 20;
      const MENU_FONT_SIZE1 = 48;
      default_font.drawAlignedSized(panel_font_style, x, y, Z_UI, MENU_FONT_SIZE1, MENU_FONT_SIZE1,
        glov_font.ALIGN.HCENTER, w, 0,
        'Recipes and Resources');
      y += MENU_FONT_SIZE1;

      const font_size = 32;
      const line_size = 42;
      let idx = 0;
      let num_per_page = 18;
      let idx0 = recipes_page * num_per_page;
      let idx1 = (recipes_page + 1) * num_per_page;

      for (let ii = 0; ii < resource_types.length; ++ii) {
        let r = resource_types[ii];
        if (!r || !r.quantity) {
          continue;
        }
        if (idx >= idx0 && idx < idx1) {
          drawResource(x, y, r.tile);
          default_font.drawSized(panel_font_style, x + TILE_SIZE + 4, y, Z_UI, font_size, font_size,
            `${r.type} (\$${r.value})`);
          y += line_size;
        }
        idx++;
      }
      for (let ii = 0; ii < recipes.length; ++ii) {
        let r = recipes[ii];
        if (idx >= idx0 && idx < idx1) {
          drawResource(x, y, r[0]);
          default_font.drawSized(panel_font_style, x + TILE_SIZE + 4, y, Z_UI, font_size, font_size,
            `${r[1]} (\$${r[2]})`);

          let xx = x + 400;
          let ingred = r.slice(3);
          for (let ii = 0; ii < ingred.length; ++ii) {
            default_font.drawSized(panel_font_style, xx, y, Z_UI, font_size, font_size, (ii === 0) ? '=' : '+');
            xx += font_size * 2;
            if (ingred[ii]) {
              drawResource(xx, y, resource_types[findResourceType(ingred[ii])].tile);
              xx += TILE_SIZE;
            }
            default_font.drawSized(panel_font_style, xx, y, Z_UI, font_size, font_size, ingred[ii] || '(anything)');
            xx += 180;
          }
          y += line_size;
        }
        idx++;
      }

      if (recipes_page && glov_ui.buttonText(16 + (BUTTON_W + 4) * 1.5, game_height - BUTTON_H - 16, Z_UI, BUTTON_W, BUTTON_H, 'Prev Page')) {
        recipes_page--;
      }
      if (((recipes_page + 1) * num_per_page <= idx) &&  glov_ui.buttonText(16 + (BUTTON_W + 4) * 2.5, game_height - BUTTON_H - 16, Z_UI, BUTTON_W, BUTTON_H, 'Next Page')) {
        recipes_page++;
      }

      if (glov_ui.buttonText(16, game_height - BUTTON_H - 16, Z_UI, BUTTON_W, BUTTON_H, 'Back')) {
        play_state = 'menu';
      }
      drawPanel(0, 0, Z_UI - 1, game_width, game_height);
    }
    if (status) {
      const STATUS_H = 32;
      default_font.drawSized(panel_font_style, (BUTTON_W  + 4) * button_bottom_count + 40, UI_BOTTOM - STATUS_H - (BUTTON_H - STATUS_H) / 2, Z_UI, STATUS_H, STATUS_H, status);
    }

    if (play_state !== 'menu' && play_state !== 'recipes') {
      // bar under bottom UI
      let bar_h = BUTTON_H + 16;
      drawPanel(configureParams.viewportRectangle[0] - 64, UI_BOTTOM - bar_h, Z_UI - 2,
        configureParams.viewportRectangle[2] - configureParams.viewportRectangle[0] + 128, bar_h + 64);

      let tut_state = tutorial_states[dd.tutorial_state];
      if (tut_state) {
        let tut_msg = tut_state.msg;
        if (tut_msg) {
          let font_size = 24;
          let tut_h = tut_msg.length * font_size + font_size * 1.5 + 16*2;
          let tut_w = 400;
          let tut_x = configureParams.viewportRectangle[2] - tut_w;
          let tut_y0 = configureParams.viewportRectangle[3] - bar_h - tut_h;
          let tut_y = tut_y0 + 16;
          default_font.drawSized(panel_font_style, tut_x + 16, tut_y, Z_TUT, font_size * 1.5, font_size * 1.5,
            'Tutorial');
          tut_y += font_size * 1.5;
          for (let ii = 0; ii < tut_msg.length; ++ii) {
            default_font.drawSized(panel_font_style, tut_x + 16, tut_y, Z_TUT, font_size, font_size,
              tut_msg[ii]);
            tut_y += font_size;
          }
          drawPanel(tut_x, tut_y0, Z_TUT, tut_w, tut_h);
        }
        let indicator;
        if (tut_state.indicator) {
          indicator = {
            x: tut_state.indicator.x * TILE_SIZE + view_offset[0] + TILE_SIZE / 2,
            y: tut_state.indicator.y * TILE_SIZE + view_offset[1] + 32,
          };
        }
        if (tut_state.indicator_name) {
          indicator = indicator_pos[tut_state.indicator_name];
        }
        if (indicator) {
          draw_list.queue(sprites.green_arrow, indicator.x - TILE_SIZE/2, indicator.y - TILE_SIZE - 30 * Math.abs(Math.sin(global_timer * 0.005)), 10000, [1,1,1,0.75]);
        }
        if (tut_state.done && tut_state.done()) {
          dd.tutorial_state++;
        }
      }
    }

    doPanning();

    if (play_state === 'preview') {
      let pos;
      if ((pos = input.clickHit(-Infinity, -Infinity, Infinity, Infinity))) {
        floatTextUI(pos[0] - 80, pos[1] - 24, FLOATER_TIME_BUY, 'Cannot build during preview', font_style_buy);
      }
    }

    draw_list.queue(sprites.background, -TILE_SIZE * 20 + view_offset[0], -TILE_SIZE * 20 + view_offset[1], 1, [1, 1, 1, 1]);
    // darken out of bounds, if visible
    let darken_color = [0, 0, 0, 0.25];
    draw_list.queue(sprites.white, -TILE_SIZE * 20 + view_offset[0], -TILE_SIZE * 20 + view_offset[1], 1.5, darken_color,
      [TILE_SIZE * (40 + dd.map.length), TILE_SIZE * 20, 1, 1]);
    draw_list.queue(sprites.white, -TILE_SIZE * 20 + view_offset[0], dd.map[0].length * TILE_SIZE + view_offset[1], 1.5, darken_color,
      [TILE_SIZE * (40 + dd.map.length), TILE_SIZE * 20, 1, 1]);
    draw_list.queue(sprites.white, -TILE_SIZE * 20 + view_offset[0], 0 + view_offset[1], 1.5, darken_color,
      [TILE_SIZE * 20, TILE_SIZE * dd.map[0].length, 1, 1]);
    draw_list.queue(sprites.white, dd.map.length * TILE_SIZE + view_offset[0], 0 + view_offset[1], 1.5, darken_color,
      [TILE_SIZE * 20, TILE_SIZE * dd.map[0].length, 1, 1]);
    if (DEBUG) {
      // darken out-of-aspect
      const extra = 1000;
      draw_list.queue(sprites.white, -extra, -extra, 1.75, [1, 0, 0, 0.5],
        [game_width + extra, extra, 1, 1]);
      draw_list.queue(sprites.white, -extra, game_height, 1.75, [1, 0, 0, 0.5],
        [game_width + extra, extra, 1, 1]);
      draw_list.queue(sprites.white, -extra, 0, 1.75, [1, 0, 0, 0.5],
        [extra, game_height, 1, 1]);
      draw_list.queue(sprites.white, game_width, 0, 1.75, [1, 0, 0, 0.5],
        [extra, game_height, 1, 1]);
    }
    let eff_current_tile = current_tile;
    if (input.isKeyDown(keyCodes.LEFT_SHIFT) || input.isKeyDown(keyCodes.RIGHT_SHIFT)) {
      eff_current_tile = 'sell';
    }
    for (let ii = 0; ii < dd.map.length; ++ii) {
      let x = ii * TILE_SIZE + view_offset[0];
      for (let jj = 0; jj < dd.map[ii].length; ++jj) {
        let y = jj * TILE_SIZE + view_offset[1];
        let tile = dd.map[ii][jj];
        if (tile && tile.nodraw) {
          continue;
        }
        let tile_size = tile && tile_type_size[tile.type] || 1;
        let do_draw = true;
        if (play_state === 'build') {
          if (tile && (tile.type === 'base' || tile.type === 'resource')) {
            // not sellable
            if (input.isMouseOver(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {

              let lines = [];
              if (tile.type === 'base') {
                lines = [
                  'Your Base',
                  'Deliver resources here',
                  'to earn money.'
                ];
              } else {
                if (input.clickHit(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {
                  show_recipes = !show_recipes;
                }
                lines = [
                  'Resource: ' + resource_types[tile.resource].type,
                  'Quantity: ' + resource_types[tile.resource].quantity,
                  'Value: $' + resource_types[tile.resource].value,
                ];
                if (show_recipes) {
                  lines.push('Recipes:');
                  for (let ii = 0; ii < recipes.length; ++ii) {
                    let r = recipes[ii];
                    let match = false;
                    for (let jj = 3; jj < r.length; ++jj) {
                      if (r[jj] === resource_types[tile.resource].type) {
                        match = true;
                      }
                    }
                    let ingre = [];
                    if (match) {
                      for (let jj = 3; jj < r.length; ++jj) {
                        ingre.push(r[jj] || '?');
                      }
                      lines.push(`  ${r[1]} (\$${resource_types[findResourceType(r[1])].value}) = `,
                        '    ' + ingre.join(' + '));
                    }
                  }
                } else {
                  lines.push('', '(click resource to','show recipes)');
                }
              }
              if (lines) {
                let h = 8 + lines.length * TOOLTIP_FONT_SIZE + 8;
                let tx = x + TILE_SIZE;
                let ty0 = y;
                if (ty0 + h > configureParams.viewportRectangle[3]) {
                  ty0 = configureParams.viewportRectangle[3] - h;
                }
                let ty = ty0 + 8;
                if (tx + TOOLTIP_W > configureParams.viewportRectangle[2]) {
                  tx = x - TOOLTIP_W;
                }
                for (let ii = 0; ii < lines.length; ++ii) {
                  default_font.drawSized(panel_font_style, tx + 16, ty, Z_UI + 3, TOOLTIP_FONT_SIZE, TOOLTIP_FONT_SIZE, lines[ii]);
                  ty += TOOLTIP_FONT_SIZE;
                }
                ty += 8;
                drawPanel(tx, ty0, Z_UI + 2, TOOLTIP_W, ty - ty0);
              }
            }
          } else {
            if (tile) {
              let do_sell = false;
              if (eff_current_tile === 'sell' && input.clickHit(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {
                do_sell = true;
              }
              if (input.clickHit(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size, 1)) {
                do_sell = true;
              }
              if (do_sell) {
                if (current_tile !== 'sell') {
                  // "pick up" what we sold
                  current_tile = tile.type;
                  current_direction = tile.direction;
                }
                dd.buyTile(ii, jj, null);
              }
            }
            if (eff_current_tile === 'sell') {
              if (input.isMouseOver(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {
                if (!tile) {
                  drawTile('sell', 0, ii, jj, Z_BUILD_TILE, [1, 1, 1, 0.5]);
                } else {
                  drawTile('sell', 0, ii, jj, Z_BUILD_TILE, [1, 1, 1, 1]);
                }
              }
            }
          }
          if (eff_current_tile !== 'sell') {
            if (dd.canPlaceTile(ii, jj, current_tile) || tile && tile.type === current_tile) {
              if (input.clickHit(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {
                dd.buyTile(ii, jj, current_tile, current_direction);
                if (tile && tile.type === current_tile) {
                  current_direction = tile.direction;
                }
                do_draw = false;
                drawTile(current_tile, current_direction, ii, jj, Z_BUILD_TILE, [1, 1, 1, 0.5]);
              } else if (input.isMouseOver(x, y, TILE_SIZE * tile_size, TILE_SIZE * tile_size)) {
                let dir = current_direction;
                if (tile && tile.type === current_tile) {
                  do_draw = false;
                  dir = tile.direction; //(tile.direction + 1) % 4;
                }
                drawTile(current_tile, dir, ii, jj, Z_BUILD_TILE, [1, 1, 1, 0.5]);
              }
            }
          }
        }
        if (tile && !tile.nodraw && do_draw) {
          let color = color_white;
          if (play_state !== 'build' && actor_types[tile.type]) {
            color = color_has_actor;
          }
          if (tile.type === 'resource') {
            if (!tile.quantity) {
              color = color_resource_depleted;
            } else if (tile.quantity !== tile.base_quantity) {
              color = color_resource_non_full;
            }
          }
          drawTile(tile.type, tile.direction, ii, jj, Z_TILES, color);

          if (tile.contents) {
            let mapping = null;
            let idx_offs=0;
            let idx_max=1000;
            if (tile.type === 'base') {
              mapping = base_contents_coords;
            } else if (craft_contents_coords[tile.type]) {
              mapping = craft_contents_coords[tile.type];
              idx_offs = tile.direction;
              idx_max = 4;
            }
            if (mapping) {
              for (let contents_index = 0; contents_index < tile.contents.length; ++contents_index) {
                let ci = (contents_index + idx_offs) % idx_max;
                let res = tile.contents[contents_index];
                if (res) {
                  // look for resource transfered to us this frame (will be drawn on actor)
                  let coords = mapping[ci];
                  let rt = null;
                  for (let rti = 0; rti < dd.resource_transfers.length; ++rti) {
                    let rtt = dd.resource_transfers[rti];
                    if (rtt[3] === ii + coords[0] && rtt[4] === jj + coords[1]) {
                      rt = rtt;
                    }
                  }
                  if (contents_index === 0) {
                    // look for craftings happening this frame
                    for (let craft_index = 0; craft_index < dd.craftings.length; ++craft_index) {
                      if (dd.craftings[craft_index].x === ii && dd.craftings[craft_index].y === jj) {
                        rt = dd.craftings[craft_index];
                      }
                    }
                  }
                  if (!rt) {
                    drawTile('resource', resource_types[res].tile, ii + coords[0], jj + coords[1], Z_ACTORS_CARRYING, color_white);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Draw interpolated actors
    let progress = (1 - tick_countdown);
    if (dd.power < 0) {
      progress = 0;
    }
    // [0,0.5,1] -> [0,1,1]
    let blend = easeInOut(
      Math.min(1, Math.max(0, 2 * progress)),
      2
    );
    let craft_blend = blend;
    // [0,bump_time,bump_time*2,1] = [0,0.3,0,0];
    let bump_time = 0.2;
    let bump_blend = 0.3 * easeIn(Math.max(0, 1 - 1/bump_time * Math.abs(bump_time - progress)), 2);
    // [0,0.5,1] -> [0,0,1]
    let resource_blend = easeInOut(
      Math.min(1, Math.max(0, 2 * progress - 1)),
      2
    );
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
      let tile = direction;
      if (dd.power < 0) {
        tile = 4;
      }
      drawTile(actor.type, tile, x, y, Z_ACTORS, color_white);
      // TODO: animate this, needs to not be black
      // Also, hop the drone up and down a little mid-turn
      // if (direction !== actor.last_direction) {
      //   drawTile('arrow', direction, x, y, Z_ACTORS + 0.5, [0, 1, 0, 1]);
      // }
      if (actor.carrying) {
        // do resources transfered to us
        let rt = null;
        for (let ii = 0; ii < dd.resource_transfers.length; ++ii) {
          let rtt = dd.resource_transfers[ii];
          // Look for a resource transfered to us
          if (rtt[3] === actor.x && rtt[4] === actor.y) {
            rt = rtt;
          }
        }
        let rx = x;
        let ry = y;
        if (rt) {
          rx = rt[1] + (rt[3] - rt[1]) * resource_blend;
          ry = rt[2] + (rt[4] - rt[2]) * resource_blend;
        }
        drawTile('resource', resource_types[actor.carrying].tile, rx, ry, Z_ACTORS_CARRYING, color_white);
      }
      // do resources transfered from us
      let rt = null;
      for (let ii = 0; ii < dd.resource_transfers.length; ++ii) {
        let rtt = dd.resource_transfers[ii];
        // Look for a resource transfered from us
        if (rtt[1] === actor.x && rtt[2] === actor.y) {
          rt = rtt;
        }
      }
      if (rt) {
        let rx = x + (rt[3] - x) * resource_blend;
        let ry = y + (rt[4] - y) * resource_blend;
        drawTile('resource', resource_types[rt[0]].tile, rx, ry, Z_ACTORS_CARRYING, color_white);
      }
    }

    // interpolated crafting
    for (let ii = 0; ii < dd.craftings.length; ++ii) {
      let craft = dd.craftings[ii];
      let type = craft.tile.type;
      let contents_coords = craft_contents_coords[type];
      let target = contents_coords[craft.tile.direction];
      for (let jj = 0; jj < craft.ingred.length; ++jj) {
        let idx = (4 - (craft.ingred.length - jj) + craft.tile.direction) % 4;
        let src = contents_coords[idx];
        let x = craft.x + src[0] + (target[0] - src[0]) * craft_blend;
        let y = craft.y + src[1] + (target[1] - src[1]) * craft_blend;
        drawTile('resource', resource_types[craft.ingred[jj]].tile, x, y, Z_ACTORS_CARRYING-1, [1,1,1, 1-craft_blend]);
      }
      // was this resource already tnasfered away?
      let rt;
      for (let rti = 0; rti < dd.resource_transfers.length; ++rti) {
        let rtt = dd.resource_transfers[rti];
        if (rtt[1] === craft.x + target[0] && rtt[2] === craft.y + target[1]) {
          rt = rtt;
        }
      }
      if (!rt) {
        drawTile('resource', resource_types[craft.res].tile, craft.x + target[0], craft.y + target[1], Z_ACTORS_CARRYING, [1,1,1,craft_blend]);
      }
    }

    for (let ii = floaters.length - 1; ii >= 0; --ii) {
      let fl = floaters[ii];
      fl.t += dt;
      let y = fl.y - easeOut(fl.t / fl.time, 2) * FLOATER_DIST;
      if (fl.t > fl.time) {
        floaters[ii] = floaters[floaters.length - 1];
        floaters.pop();
      } else {
        /*jshint bitwise:false*/
        let a = Math.min(1, (2 - 2 * fl.t / fl.time)) * 255 | 0;
        let style = glov_font.style(fl.style, {
          color: fl.style.color & 0xFFFFFF00 | a,
          outline_color: fl.style.outline_color & 0xFFFFFF00 | a,
        });
        default_font.drawSized(style, fl.x + (fl.is_ui ? 0 : view_offset[0]), y + (fl.is_ui ? 0 : view_offset[1]), fl.z, FLOATER_SIZE, FLOATER_SIZE, fl.text);
      }
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
    input.endFrame();
  }

  intervalID = TurbulenzEngine.setInterval(tick, 1000/60);
};
