const glov_font = require('./glov_font.js');
class GlovUI {
  buildRects(ws, hs) {
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
        let r = this.mathDevice.v4Build(x, y, x + ws[ii], y + hs[jj]);
        rects.push(r);
        x += ws[ii];
      }
      y += hs[jj];
    }
    return {
      rects,
      percents_w,
      percents_h,
      total_w,
      total_h,
    };
  }

  loadSpriteRect(filename, widths, heights) {
    let uidata = this.buildRects(widths, heights);
    let sprite = this.glov_sprite.createSprite(filename, {
      width : 1,
      height : 1,
      rotation : 0,
      textureRectangle : this.mathDevice.v4Build(0, 0, uidata.total_w, uidata.total_h),
      origin: [0,0],
    });
    sprite.uidata = uidata;
    return sprite;
  }

  constructor(mathDevice, glov_sprite, glov_input, font, draw_list) {
    this.glov_sprite = glov_sprite;
    this.glov_input = glov_input;
    this.font = font;
    this.draw_list = draw_list;
    this.mathDevice = mathDevice;

    this.color_white = mathDevice.v4Build(1, 1, 1, 1);
    this.color_black = mathDevice.v4Build(0,0,0, 1);
    this.color_rollover = mathDevice.v4Build(0.8, 0.8, 0.8, 1);
    this.color_click = mathDevice.v4Build(0.7, 0.7, 0.7, 1);

    let sprites = this.sprites = {};
    sprites.button = this.loadSpriteRect('button.png', [4, 5, 4], [13]);
  }

  drawHBox(s, x, y, z, w, h, color) {
    let uidata = s.uidata;
    let scale = h;
    let ws = [uidata.percents_w[0] * scale, 0, uidata.percents_w[2] * scale];
    ws[1] = Math.max(0, w - ws[0] - ws[2]);
    for (let ii = 0; ii < ws.length; ++ii) {
      let my_w = ws[ii];
      this.draw_list.queue(s, x, y, z, color, [my_w, scale, 1, 1], uidata.rects[ii]);
      x += my_w;
    }
  }

  drawBox(s, x, y0, z, w, h, pixel_scale, color) {
    let uidata = s.uidata;
    let scale = pixel_scale;
    let ws = [uidata.percents_w[0] * scale, 0, uidata.percents_w[2] * scale];
    ws[1] = Math.max(0, w - ws[0] - ws[2]);
    let hs = [uidata.percents_h[0] * scale, 0, uidata.percents_h[2] * scale];
    hs[1] = Math.max(0, h - hs[0] - hs[2]);
    for (let ii = 0; ii < ws.length; ++ii) {
      let my_w = ws[ii];
      let y = y0;
      for (let jj = 0; jj < hs.length; ++jj) {
        let my_h = hs[jj];
        this.draw_list.queue(s, x, y, z, color, [my_w, my_h, 1, 1], uidata.rects[jj * 3 + ii]);
        y += my_h;
      }
      x += my_w;
    }
  }

  buttonShared(x, y, w, h) {
    let color = this.color_white;
    let ret = false;
    if (this.glov_input.clickHit(x, y, w, h)) {
      color = this.color_click;
      ret = true;
    } else if (this.glov_input.isMouseOver(x, y, w, h)) {
      color = this.glov_input.isMouseDown() ? this.color_click : this.color_rollover;
    }
    return {ret, color};
  }

  buttonText(x, y, z, w, h, text) {
    let shared = this.buttonShared(x, y, w, h);

    this.drawHBox(this.sprites.button, x, y, z, w, h, shared.color);
    let font_h = h * 0.70;
    /*jshint bitwise:false*/
    this.font.drawAlignedSized(glov_font.styleColored(null, 0x000000ff), x, y, z + 0.1,
      font_h, font_h, glov_font.ALIGN.HCENTER | glov_font.ALIGN.VCENTER, w, h, text);
    return shared.ret;
  }

  buttonImage(x, y, z, w, h, img, img_rect) {
    let shared = this.buttonShared(x, y, w, h);

    this.drawHBox(this.sprites.button, x, y, z, w, h, shared.color);
    this.draw_list.queue(img, x + (w - img.getWidth()) / 2, y + (h - img.getHeight()) / 2, z + 0.1, shared.color, null, img_rect);
    return shared.ret;
  }

}

export function create(mathDevice, glov_sprite, glov_input, font, draw_list) {
  return new GlovUI(mathDevice, glov_sprite, glov_input, font, draw_list);
}