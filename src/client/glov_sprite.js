/*global Draw2DSprite: false */
/*global RequestHandler: false */
/*global TextureManager: false */

class GlovSpriteManager {
  constructor(graphicsDevice) {
    const requestHandler = RequestHandler.create({});
    this.textureManager = TextureManager.create(graphicsDevice, requestHandler);
    this.textures = {};
  }

  loadTexture(texname) {
    let path = texname;
    if (texname.indexOf('.') !== -1) {
      path = 'img/'+ texname;
    }
    const inst = this.textureManager.getInstance(path);
    if (inst) {
      return inst;
    }
    this.textures[texname] = this.textureManager.load(path, false);
    return this.textureManager.getInstance(path);
  }
  createSprite(texname, params) {
    const tex_inst = this.loadTexture(texname);
    params.texture = tex_inst.getTexture();
    const sprite = Draw2DSprite.create(params);
    tex_inst.subscribeTextureChanged(function () {
      sprite.setTexture(tex_inst.getTexture());
    });
    return sprite;
  }

}

export function create(graphicsDevice) {
  return new GlovSpriteManager(graphicsDevice);
}
