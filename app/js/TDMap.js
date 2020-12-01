
TDMap={}

function getMap(mapName) {
  return TDMap[mapName]
}
function initMapIfNotExists(mapName) {
  if (TDMap[mapName] == undefined) {
    TDMap[mapName] = {}
  }
}
function getValue(mapName, keyName) {
  return TDMap[mapName][keyName]
}
function setValue(mapName, keyName, value) {
  TDMap[mapName][keyName] = value
}
function ifMapNotExists(mapName){
  if (TDMap[mapName] == undefined) {
    return true
  } else {
    return false;
  }
}
function ifValueNotExists(mapName, keyName){
  if (TDMap[mapName][keyName] == undefined) {
    return true
  } else {
    return false;
  }
}
function deleteKey(mapName, keyName) {
  delete TDMap[mapName][keyName]
}
module.exports = {
  getMap,
  initMapIfNotExists,
  getValue,
  setValue,
  ifMapNotExists,
  ifValueNotExists,
  deleteKey
}