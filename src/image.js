// Minimal image generator that returns a PNG-like buffer without external deps.
async function generateVariant({sourceBuffer, width=256, height=256, overlayText}){
  // Return a small PNG header plus metadata to simulate a generated image.
  const header = Buffer.from('89504e470d0a1a0a', 'hex');
  const info = Buffer.from(JSON.stringify({w: width, h: height, overlay: !!overlayText}));
  return Buffer.concat([header, info]);
}

module.exports = {generateVariant};
