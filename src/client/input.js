
const UP_EDGE = 0;
const DOWN_EDGE = 1;
const DOWN = 2;

class GlovInput {
  constructor(input_device, draw2d) {
    this.input_device = input_device;
    this.draw2d = draw2d;
    this.key_state = {};
    this.pad_states = []; // One map per joystick
    this.clicks = [];
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.mouse_mapped = [0,0];
    this.mouse_over_captured = false;
    this.mouse_down = [];
    this.pad_threshold = 0.25;
    this.last_touch_state = [];
    this.touch_state = [];
    this.touch_as_mouse = true;

    this.padCodes = input_device.padCodes;
    this.padCodes.ANALOG_UP = 20;
    this.padCodes.ANALOG_LEFT = 21;
    this.padCodes.ANALOG_DOWN = 22;
    this.padCodes.ANALOG_RIGHT = 23;

    input_device.addEventListener('keydown', keycode => this.onKeyDown(keycode));
    input_device.addEventListener('keyup', keycode => this.onKeyUp(keycode));

    input_device.addEventListener('mousedown', (mousecode, x, y) => this.onMouseDown(mousecode, x, y));
    input_device.addEventListener('mouseup', (mousecode, x, y) => this.onMouseUp(mousecode, x, y));
    input_device.addEventListener('mouseover', (x,y) => this.onMouseOver(x, y));


    input_device.addEventListener('paddown', (padindex, padcode) => this.onPadDown(padindex, padcode));
    input_device.addEventListener('padup', (padindex, padcode) => this.onPadUp(padindex, padcode));
    input_device.addEventListener('padmove', (padindex, x, y, z, rx, ry, rz) => this.onPadMove(padindex, x, y, z, rx, ry, rz));

    input_device.addEventListener('touchstart', (evt) => this.onTouchChange(evt));
    input_device.addEventListener('touchend', (evt) => this.onTouchChange(evt));
    input_device.addEventListener('touchmove', (evt) => this.onTouchChange(evt));

  }
  tick() {
    // browser frame has occurred since the call to endFrame(),
    // we should now have .clicks and this.key_state populated with edge events
    this.mouse_over_captured = false;
    this.input_device.update();
  }
  endFrame()
  {
    function tickMap(map) {
      Object.keys(map).forEach(keycode => {
        switch(map[keycode]) {
          case DOWN_EDGE:
            map[keycode] = DOWN;
            break;
          case UP_EDGE:
            delete map[keycode];
            break;
        }
      });
    }
    tickMap(this.key_state);
    this.pad_states.forEach(tickMap);
    this.clicks = [];
  }

  onMouseDown(mousecode, x, y) {
    this.onMouseOver(x, y); // update this.mouse_mapped
    this.mouse_down[mousecode] = true;
  }
  onMouseUp(mousecode, x, y) {
    this.onMouseOver(x, y); // update this.mouse_mapped
    this.clicks[mousecode] = this.clicks[mousecode] || [];
    this.clicks[mousecode].push(this.mouse_mapped.slice(0));
    this.mouse_down[mousecode] = false;
  }
  onMouseOver(x, y) {
    this.mouse_x = x;
    this.mouse_y = y;
    this.draw2d.viewportMap(x, y, this.mouse_mapped);
  }
  isMouseOver(x, y, w, h) {
    if (this.mouse_over_captured) {
      return false;
    }
    if (this.mouse_mapped[0] >= x && this.mouse_mapped[0] < x + w &&
      this.mouse_mapped[1] >= y && this.mouse_mapped[1] < y + h
    ) {
      this.mouse_over_captured = true;
      return true;
    }
    return false;
  }
  isMouseOverSprite(sprite) {
    const w = sprite.getWidth();
    const h = sprite.getHeight();
    const origin = sprite.getOrigin();
    return this.isMouseOver(sprite.x - origin[0], sprite.y - origin[1], w, h);
  }
  isMouseDown(button) {
    button = button || 0;
    return this.mouse_down[button];
  }
  mousePos() {
    return [this.mouse_mapped[0], this.mouse_mapped[1]];
  }
  clickHit(x, y, w, h, button) {
    button = button || 0;
    if (!this.clicks[button]) {
      return false;
    }
    for (var ii = 0; ii < this.clicks[button].length; ++ii) {
      var pos = this.clicks[button][ii];
      if (pos[0] >= x && (w === Infinity || pos[0] < x + w) && pos[1] >= y && (h === Infinity || pos[1] < y + h)) {
        this.clicks[button].splice(ii, 1);
        return pos;
      }
    }
    return false;
  }
  clickHitSprite(sprite) {
    const w = sprite.getWidth();
    const h = sprite.getHeight();
    return this.clickHit(sprite.x - w/2, sprite.y - h/2, w, h);
  }

  onTouchChange(param) {
    this.last_touch_state = this.touch_state;
    this.touch_state = param.touches || [];
    if (this.touch_as_mouse) {
      if (this.last_touch_state.length === 1 && this.touch_state.length === 0) {
        // click!
        this.mouse_down[0] = false;
        // update this.mouse_mapped
        this.onMouseOver(this.last_touch_state[0].positionX, this.last_touch_state[0].positionY);
        this.clicks[0] = this.clicks[0] || [];
        this.clicks[0].push(this.mouse_mapped.slice(0));
      } else if (this.touch_state.length === 1) {
        this.mouse_down[0] = true;
        this.onMouseOver(this.touch_state[0].positionX, this.touch_state[0].positionY);
      } else if (this.touch_state.length > 1) {
        this.mouse_down[0] = false;
        // no click
      }
    }
    //throw JSON.stringify(param, undefined, 2);
  }
  isTouchDown(x, y, w, h) {
    var pos = [];
    for (var ii = 0; ii < this.touch_state.length; ++ii) {
      this.draw2d.viewportMap(this.touch_state[ii].positionX, this.touch_state[ii].positionY, pos);
      if (x === undefined || pos[0] >= x && pos[0] < x + w && pos[1] >= y && pos[1] < y + h) {
        return pos;
      }
    }
    return false;
  }
  isTouchDownSprite(sprite) {
    const w = sprite.getWidth();
    const h = sprite.getHeight();
    return this.isTouchDown(sprite.x - w/2, sprite.y - h/2, w, h);
  }

  onKeyUp(keycode) {
    this.key_state[keycode] = UP_EDGE;
  }
  onKeyDown(keycode) {
    this.key_state[keycode] = DOWN_EDGE;
  }
  isKeyDown(keycode) {
    return !!this.key_state[keycode];
  }
  keyDownHit(keycode) {
    if (this.key_state[keycode] === DOWN_EDGE) {
      this.key_state[keycode] = DOWN;
      return true;
    }
    return false;
  }
  keyUpHit(keycode) {
    if (this.key_state[keycode] === UP_EDGE) {
      delete this.key_state[keycode];
      return true;
    }
    return false;
  }

  onPadUp(padindex, padcode) {
    this.pad_states[padindex] = this.pad_states[padindex] || { axes: {} };
    this.pad_states[padindex][padcode] = UP_EDGE;
  }
  onPadDown(padindex, padcode) {
    this.pad_states[padindex] = this.pad_states[padindex] || { axes: {} };
    this.pad_states[padindex][padcode] = DOWN_EDGE;
  }
  onPadMove(padindex, x, y, z, rx, ry, rz) {
    var ps = this.pad_states[padindex] = this.pad_states[padindex] || { axes: {} };
    ps.axes.x = x;
    ps.axes.y = y;
    ps.axes.z = z;
    ps.axes.rx = rx;
    ps.axes.ry = ry;
    ps.axes.rz = rz;
    // Calculate virtual directional buttons
    function check(b, c) {
      if (b) {
        if (ps[c] !== DOWN) {
          ps[c] = DOWN_EDGE;
        }
      } else if (ps[c]) {
        ps[c] = UP_EDGE;
      }
    }
    check(x < -this.pad_threshold, this.padCodes.ANALOG_LEFT);
    check(x > this.pad_threshold, this.padCodes.ANALOG_RIGHT);
    check(y < -this.pad_threshold, this.padCodes.ANALOG_DOWN);
    check(y > this.pad_threshold, this.padCodes.ANALOG_UP);
  }
  isPadButtonDown(padindex, padcode) {
    if (!this.pad_states[padindex]) {
      return false;
    }
    if (padcode === this.padCodes.LEFT && this.isPadButtonDown(padindex, this.padCodes.ANALOG_LEFT)) {
      return true;
    }
    if (padcode === this.padCodes.RIGHT && this.isPadButtonDown(padindex, this.padCodes.ANALOG_RIGHT)) {
      return true;
    }
    if (padcode === this.padCodes.UP && this.isPadButtonDown(padindex, this.padCodes.ANALOG_UP)) {
      return true;
    }
    if (padcode === this.padCodes.DOWN && this.isPadButtonDown(padindex, this.padCodes.ANALOG_DOWN)) {
      return true;
    }
    return !!this.pad_states[padindex][padcode];
  }
  padDownHit(padindex, padcode) {
    if (!this.pad_states[padindex]) {
      return false;
    }
    if (padcode === this.padCodes.LEFT && this.padDownHit(padindex, this.padCodes.ANALOG_LEFT)) {
      return true;
    }
    if (padcode === this.padCodes.RIGHT && this.padDownHit(padindex, this.padCodes.ANALOG_RIGHT)) {
      return true;
    }
    if (padcode === this.padCodes.UP && this.padDownHit(padindex, this.padCodes.ANALOG_UP)) {
      return true;
    }
    if (padcode === this.padCodes.DOWN && this.padDownHit(padindex, this.padCodes.ANALOG_DOWN)) {
      return true;
    }
    if (this.pad_states[padindex][padcode] === DOWN_EDGE) {
      this.pad_states[padindex][padcode] = DOWN;
      return true;
    }
    return false;
  }
  padUpHit(padindex, padcode) {
    if (!this.pad_states[padindex]) {
      return false;
    }
    if (padcode === this.padCodes.LEFT && this.padUpHit(padindex, this.padCodes.ANALOG_LEFT)) {
      return true;
    }
    if (padcode === this.padCodes.RIGHT && this.padUpHit(padindex, this.padCodes.ANALOG_RIGHT)) {
      return true;
    }
    if (padcode === this.padCodes.UP && this.padUpHit(padindex, this.padCodes.ANALOG_UP)) {
      return true;
    }
    if (padcode === this.padCodes.DOWN && this.padUpHit(padindex, this.padCodes.ANALOG_DOWN)) {
      return true;
    }
    if (this.pad_states[padindex][padcode] === UP_EDGE) {
      delete this.pad_states[padindex][padcode];
      return true;
    }
    return false;
  }

}

export function create(input_device, draw2d) {
  return new GlovInput(input_device, draw2d);
}
