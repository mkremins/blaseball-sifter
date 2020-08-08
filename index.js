const datascript = require('datascript');
const request = require('request');
const say = require('say');
const tracery = require('tracery-grammar');

/// ad-hoc blaseball API

const blaseballBaseURL = 'https://blaseball.com/database/';

function getEndpoint(endpoint, params, cb) {
  const paramsStr = Object.keys(params).map(key => key + '=' + params[key]).join('&');
  const url = `${blaseballBaseURL}/${endpoint}?${paramsStr}`;
  //console.log(url);
  request({url}, function(err, res, body) {
    // TODO assumes no error which isn't great
    cb(JSON.parse(body));
  });
}

/// TTS stuff

const voice = 'Alex';

function fixPronunciation(str) {
  return str.toLowerCase().split('blaseball').join('blayce ball');
}

function logAndSay(str) {
  console.log(str);
  say.speak(fixPronunciation(str), voice, 1.0, speakCallback);
}

const speechQueue = [];
let isSpeaking = false;

function speakCallback(err) {
  if (speechQueue.length > 0) {
    const nextStr =  speechQueue.shift();
    logAndSay(nextStr);
  } else {
    isSpeaking = false;
  }
}

function speak(str) {
  str = fixPronunciation(str);
  if (!isSpeaking) {
    isSpeaking = true;
    logAndSay(str);
  } else {
    speechQueue.push(str);
  }
}

/// util

function randNth(items){
  return items[Math.floor(Math.random()*items.length)];
}

/// app

const appDB = datascript.empty_db({});

const cannedCommentaryGrammar = tracery.createGrammar({
  "blaseball": ["blaseball", "blaseball", "blaseball", "blaseball", "blasé ball"],
  "subject": ["#blaseball#", "#other_subject#",],
  "other_subject": [
    "#blaseball#", "The Tim Tebow CFL Chronicles", "#blaseball#", "The Hades Tigers", "The Commissioner",
    "The Hellmouth Sunbeams", "The Canada Moist Talkers", "The Houston Spies"
  ],
  "obj": ["is the sport of #kings#", "brings together all of the #kings#", "is for #kings#", "is doing a good job"],
  "kings": [
    "kings", "umpires", "vampires", "people", "masses", "pyromaniacs", "lovers", "shoe thieves", "gamblers",
    "streamers", "bloggers", "kids"
  ],
  "sentence": ["#subject# #obj#."],
  "oneoff": [
    "we are all love #blaseball#"
  ],
  "origin": ["#sentence#", "#sentence#", "#sentence#", "#oneoff#"]
});

function getCommentary(game) {
  return cannedCommentaryGrammar.flatten("#origin#");
}

const lastUpdates = {};

function updateGameData(season, day) {
  getEndpoint('games', {season, day}, function(games) {
    const game = games[0];
    const title = `${game.awayTeamName} at ${game.homeTeamName}, ${game.awayScore} to ${game.homeScore}`;
    if (game.lastUpdate !== lastUpdates[game._id]) {
      speak(title);
      speak(fixPronunciation(game.lastUpdate));
      lastUpdates[game._id] = game.lastUpdate;
    }
    else {
      const commentary = getCommentary(game);
      speak(commentary);
    }
  });
}

getEndpoint('simulationData', {}, function(data) {
  const seasonHeader = `Season ${data.season}, Day ${data.day}`;
  speak(seasonHeader);
  setInterval(updateGameData, 1000, data.season, data.day);
});
