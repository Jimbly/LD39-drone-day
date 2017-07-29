const glov_font = require('./glov_font.js');
class GlovUI {
  constructor(mathDevice, glov_sprite, glov_input, font, draw_list) {
    this.glov_sprite = glov_sprite;
    this.glov_input = glov_input;
    this.font = font;
    this.draw_list = draw_list;

    this.color_white = mathDevice.v4Build(1, 1, 1, 1);
    this.color_black = mathDevice.v4Build(0,0,0, 1);
    this.color_rollover = mathDevice.v4Build(0.8, 0.8, 0.8, 1);
    this.color_click = mathDevice.v4Build(0.7, 0.7, 0.7, 1);

    let sprites = this.sprites = {};
    let spriteSize = 13;
    let display_size = 1;
    sprites.button = glov_sprite.createSprite('button.png', {
      width : display_size,
      height : display_size,
      rotation : 0,
      textureRectangle : mathDevice.v4Build(0, 0, spriteSize, spriteSize),
      origin: [0,0],
    });
    function buildRects(ws, hs) {
      let rects = [];
      let total_w = 0;
      for (let ii = 0; ii < ws.length; ++ii) {
        total_w += ws[ii];
      }
      let percents_w = [];
      for (let ii = 0; ii < ws.length; ++ii) {
        percents_w.push(ws[ii] / total_w);
      }
      let total_h = 0;
      for (let ii = 0; ii < hs.length; ++ii) {
        total_h += hs[ii];
      }
      let percents_h = [];
      for (let ii = 0; ii < hs.length; ++ii) {
        percents_h.push(hs[ii] / total_h);
      }
      let y = 0;
      for (let jj = 0; jj < hs.length; ++jj) {
        let x = 0;
        for (let ii = 0; ii < ws.length; ++ii) {
          let r = mathDevice.v4Build(x, y, x + ws[ii], y + hs[jj]);
          rects.push(r);
          x += ws[ii];
        }
        y += hs[jj];
      }
      return {
        rects,
        percents_w,
        percents_h,
      };
    }
    sprites.button.uidata = buildRects([4, 5, 4], [13]);
  }

  buttonText(x, y, z, w, h, text) {
    let x0 = x;
    let color = this.color_white;
    let ret = false;
    if (this.glov_input.clickHit(x, y, w, h)) {
      color = this.color_click;
      ret = true;
    } else if (this.glov_input.isMouseOver(x, y, w, h)) {
      color = this.color_rollover;
    }

    let s = this.sprites.button;
    let uidata = s.uidata;
    let scale = h;
    let ws = [uidata.percents_w[0] * scale, 0, uidata.percents_w[2] * scale];
    ws[1] = Math.max(0, w - ws[0] - ws[2]);
    for (let ii = 0; ii < ws.length; ++ii) {
      let my_w = ws[ii];
      this.draw_list.queue(s, x, y, z, color, [my_w, scale, 1, 1], uidata.rects[ii]);
      x += my_w;
    }
    let font_h = h * 0.70;
    /*jshint bitwise:false*/
    this.font.drawAlignedSized(glov_font.styleColored(null, 0x000000ff), x0, y, z + 0.1,
      font_h, font_h, glov_font.ALIGN.HCENTER | glov_font.ALIGN.VCENTER, w, h, text);
    return ret;
  }
}

export function create(mathDevice, glov_sprite, glov_input, font, draw_list) {
  return new GlovUI(mathDevice, glov_sprite, glov_input, font, draw_list);
}
