function composeCaption({title, url, fragments=[]}, platform){
  // simple fragment-based composer: global fragments + platform-specific
  const platformTail = fragments.filter(f=>f.platform === platform).map(f=>f.text).join(' ');
  const globalTail = fragments.filter(f=>!f.platform).map(f=>f.text).join(' ');
  const caption = `${title}\n${globalTail} ${platformTail}\n${url}`.trim();
  return caption;
}

module.exports = {composeCaption};
