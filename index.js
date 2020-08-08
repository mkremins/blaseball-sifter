const datascript = require('datascript');
const request = require('request');
const say = require('say');
const tracery = require('tracery-grammar');

const {randNth, getNormalizedEditDistance} = require('./util');

/// ad-hoc blaseball API

const blaseballBaseURL = 'https://blaseball.com/database/';

function getEndpoint(endpoint, params, cb) {
  const paramsStr = Object.keys(params).map(key => key + '=' + params[key]).join('&');
  const url = `${blaseballBaseURL}/${endpoint}?${paramsStr}`;
  //console.log(url);
  request({url}, function(err, res, body) {
    if (err) {
      cb(null, err);
    } else {
      cb(JSON.parse(body));
    }
  });
}

/// TTS stuff

const voice = 'Microsoft Zira Desktop';
const color_commentary_voice = 'Microsoft Zira Desktop';


function fixPronunciation(str) {
  if (!str) return ""; // fail gracefully if undefined
  str = str.toLowerCase();
  const pronunciationFixes = [
    ['twitch.tv/blaseball_radio', 'twitch dot tv slash blayce ball underscore radio'],
    ['blaseball', randNth(['blayce ball', 'blayce ball', 'blayce ball', 'blayce ball', 'blasé ball', 'blaze ball'])],
    ['tebow', 'teebo'],
    ['dalé', 'dollay'],
    ['routed', 'rowded']
  ];
  for (let [lhs, rhs] of pronunciationFixes) {
    str = str.split(lhs).join(rhs);
  }
  return str;
}

function logAndSay(str) {
  const normalizedEditDistance = getNormalizedEditDistance(str, lastUtterance);
  //console.log(`[edit distance ${normalizedEditDistance}]`);
  if (normalizedEditDistance < 0.3) {
    if(!(str.startsWith("Foul") ||
         str.startsWith("ball") ||
         str.startsWith("strike") ||
         str.startsWith("Ball") ||
         str.startsWith("Strike"))) { // strikes and balls are very repetitive by convention
      console.log(`[skipping suspected duplicate utterance (${normalizedEditDistance}): ${str}]`);
      str = "How about that.";
   }
  }
  console.log(str);
  // varying the speed keeps the voice more interesting
  let voice_speed = 0.8 + (Math.random() * 0.5);
  say.speak(fixPronunciation(str), voice, voice_speed, speakCallback);
  if (str !== "") {
    lastUtterance = str;
  }
}

let lastUtterance = "";
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
  if (!isSpeaking) {
    isSpeaking = true;
    logAndSay(str);
  } else {
    speechQueue.push(str);
  }
}

function clearSpeechQueue() {
  //console.log(`[clearing speech queue at length ${speechQueue.length}]`);
  while(speechQueue.length) {
    speechQueue.pop();
  }
}

function pruneSpeechQueue() {
  // we don't want to accidentally clear utterances about switching teams,
  // so let's leave the first two messages intact on periodic clear for now.
  // (switching teams always clears the queue completely)
  console.log(`[pruning speech queue at length ${speechQueue.length}]`);
  while(speechQueue.length > 2) {
    speechQueue.pop();
  }
}

function speakHighPriority(str) {
  clearSpeechQueue();
  speak(str);
}

/// app

const appDB = datascript.empty_db({});

const cannedCommentaryGrammar = tracery.createGrammar({
  "blaseball": ["blaseball", "blaseball", "blaseball", "blaseball", "blasé ball", "blaze ball"],
  "subject": ["#blaseball#", "#other_subject#",],
  "other_subject": [
    "#blaseball#", "The Tim Tebow CFL Chronicles", "#blaseball#", "The Hades Tigers", "The Commissioner",
    "The Hellmouth Sunbeams", "The Canada Moist Talkers", "The Houston Spies", "Jon Bois"
  ],
  "obj": ["is the sport of #kings#", "brings together all of the #kings#", "is for #kings#", "is doing a good job"],
  "kings": [
    "kings", "umpires", "vampires", "people", "masses", "pyromaniacs", "lovers", "shoe thieves", "gamblers",
    "streamers", "bloggers", "kids"
  ],
  "sentence": ["#subject# #obj#"],
  "question": ["Did you know that #sentence#?"],
  "oneoff": [
    "We are all love #blaseball#"
  ],
  "origin": [
    "#sentence#", "#sentence#", "#sentence#",
    "#question#",
    "#oneoff#",
    "Check out twitch.tv/blaseball_radio for commentary by humans.",
    "Check out twitch.tv/blaseball_radio for human-driven commentary.",
    "You're listening to Radio Free Blaseball."
  ]
});

const nickCommentaryGrammar = tracery.createGrammar({
  "origin":["#line#"],
  "line":[
    "#teamcommentary#", "#teamcommentary#", "#teamcommentary#", "#teamcommentary#",
    "#teamcommentary#", "#teamcommentary#", "#teamcommentary#", "#teamcommentary#",
    "#teamcommentary#", "#teamcommentary#",
    "I can't believe what I'm watching", "This is getting intense",
    "In this processor we love and respect the shard", "Let us enjoy the game comrades"
  ],
  "teamcommentary":[
    "These teams are #descriptor#", "These teams #relationship# #whoinrelationship#",
    "These teams really #relationship# #whoinrelationship#", "These teams #relationship# #whoinrelationship#",
    "These teams really #relationship# #whoinrelationship#", "These teams #relationship# #whoinrelationship#",
    "These teams really #relationship# #whoinrelationship#"
  ],
  "descriptor":["unbelievable", "so evenly matched", "so splortsperson like"],
  "relationship":[
    "respect", "have no respect for", "fear", "loath", "are disrespecting", "love", "are in awe of",
    "are cowering in front of", "are cowering in the face of", "not taking any guff from", "are worried about",
    "have no fear of", "have been shamed by", "are living up to", "are going against", "are surpassing"
  ],
  "whoinrelationship":[
    "each other", "themselves", "their opponents", "the crew", "the umpires", "the birds", "the peanuts",
    "the weather", "the possibility of incineration", "Jessica Telephone's stats", "their own records",
    "their opponents' records", "the rogue umpires", "peanut allergies", "bird talons", "the Discipline Era",
    "the current standings", "the fourth strike"
  ]
});

const baalgameCommentaryGrammar = tracery.createGrammar({
     "phonetics" : ["alpha", "bravo", "charlie", "delta", "echo",
     "foxtrot", "golf", "hotel", "india", "juliet", "kilo",
     "lima", "mike", "november", "oscar", "papa", "quebec",
     "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
     "x-ray", "yankee", "zulu"],
     "phoneticsnum" : ["alpha", "bravo", "charlie", "delta", "echo",
     "foxtrot", "golf", "hotel", "india", "juliet", "kilo",
     "lima", "mike", "november", "oscar", "papa", "quebec",
     "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
     "x-ray", "yankee", "zulu", "one", "two", "three", "four",
     "five", "six", "seven", "eight", "nine", "zero"],
     "polishstyle" : ["alpha", "bravo", "charlie", "delta", "echo",
     "foxtrot", "golf", "hotel", "india", "juliet", "kilo",
     "lima", "mike", "november", "oscar", "papa", "quebec",
     "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
     "x-ray", "yankee", "zulu", "oblique", "oblique", "oblique",
     "oblique", "oblique", "oblique", "oblique", "oblique", "oblique",
     "oblique", "oblique", "oblique", "oblique", "oblique", "oblique",
     "one", "two", "three", "four", "five", "six", "seven", "eight",
     "nine", "zero"],
     "decimal" : ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
     "hexadecimal" : ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "alpha", "bravo", "charlie", "delta", "echo", "foxtrot"],
     "teams" : ["san francisco lovers", "dallas steaks", "kansas city breath mints",
     "los angeles tacos", "chicago firefighters", "hades tigers", "philly pies",
     "baltimore crabs", "mexico city wild wings", "hellmouth", "new york millennials",
     "charleston shoe thieves", "yellowstone magic", "hawaii fridays",
     "boston flowers", "canada moist talkers", "breckenridge jazz hands",
     "houston spies", "seattle garages", "miami dale"],
     "places" : ["san francisco", "dallas", "kansas city",
     "los angeles", "chicago", "hades", "philly",
     "baltimore", "mexico city", "the hellmouth", "new york",
     "charleston", "yellowstone", "hawaii",
     "boston", "canada", "breckenridge",
     "houston", "seattle", "miami"],
     "two" : ["#phonetics#. #phonetics#", "#phoneticsnum#. #phoneticsnum#.", "#polishstyle#. #polishstyle#.", "#decimal#. #decimal#.", "#hexadecimal#. #hexadecimal#."],
     "four" : ["#phonetics#. #phonetics#. #phonetics#. #phonetics#.",
     "#phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#.",
     "#polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#.",
     "#decimal#. #decimal#. #decimal#. #decimal#.",
     "#hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#."],
     "eight" : ["#phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#.",
     "#phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#.",
     "#polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#.",
     "#decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#.",
     "#hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#."],
     "twelve" : ["#phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#. #phonetics#.",
     "#phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#. #phoneticsnum#.",
     "#polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#. #polishstyle#.",
     "#decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#. #decimal#.",
     "#hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#. #hexadecimal#."],
     "planets" : ["mercury", "venus", "mars", "jupiter", "saturn", "neptune", "uranus", "pluto", "chiron", "planet x", "nibiru"],
     "zodiac" : ["aries", "cancer", "sagittarius", "libra", "virgo", "leo", "capricorn", "aquarius", "pisces", "taurus", "gemini", "scorpio"],
     "court" : ["page", "knight", "queen", "king", "jack", "knave", "bishop", "pawn", "rook"],
     "suit" : ["coins", "cups", "swords", "wands", "diamonds", "hearts", "clubs", "spades"],
     "operative" : ["#planets# in #zodiac#", "the #court# of #suit#"],
     "greeting" : ["For our friends in #places#", "For our siblings in #places#",
     "For those supporting the #teams#", "If anyone is left in #places#", "This is not a drill", "#operative#:, do not answer",
     "For #operative#"],
     "onetimepad" : ["#greeting#: #eight#", "#greeting#: #twelve#", "#greeting#: #four# Authentication #two#"]
   });

function getCannedCommentary() {
  if (Math.random() < 0.3) {
    return nickCommentaryGrammar.flatten("#origin#");
  }
  if (Math.random() < 0.066) {
    return baalgameCommentaryGrammar.flatten("#onetimepad#");
  }
  return cannedCommentaryGrammar.flatten("#origin#");
}

function getBasesState(game) {
  return [0,1,2].map(baseIdx => game.basesOccupied[baseIdx]);
}

const allWeathers = [
  "Void", "Sunny", "Overcast", "Rainy", "Sandstorm", "Snowy", "Acidic",
  "Solar Eclipse", "Glitter", "Bloodwind", "Peanuts", "Lots of Birds"
];

function getWeather(game) {
  return allWeathers[game.weather] || randNth(["normal", "fine", "remarkable", "unprecedented"]);
}

function getBaseStateCommentary(game, basesState) {
  const occupiedBaseNames = ["first", "second", "third"].filter((_, idx) => basesState[idx]);
  if (occupiedBaseNames.length === 3) {
    return "The bases are loaded";
  }
  if (occupiedBaseNames.length === 1) {
    return "There's a runner on " + occupiedBaseNames[0];
  }
  if (occupiedBaseNames.length === 2) {
    return "There are runners on " + occupiedBaseNames.join(" and ");
  }
  else {
    return randNth([
      "I'm excited!",
      "This is exciting!",
      "Many things are happening!",
      "I've never seen anything like it!"
    ]);
  }
}

function getWeatherCommentary(game) {
  const weather = getWeather(game);
  return `The weather is ${randNth(["still ","","","","","","",""])}${weather}.`;
}

function getScoreState(game) {
  const homeWinning = game.homeScore > game.awayScore;
  const homeTeam = {
    name: game.homeTeamName,
    nick: game.homeTeamNickname,
    score: game.homeScore,
    batter: game.homeBatterName,
    pitcher: game.homePitcherName
  };
  const awayTeam = {
    name: game.awayTeamName,
    nick: game.awayTeamNickname,
    score: game.awayScore,
    batter: game.awayBatterName,
    pitcher: game.awayPitcherName
  };
  const [winningTeam, losingTeam] = homeWinning ? [homeTeam, awayTeam] : [awayTeam, homeTeam];
  const scoreDifference = Math.abs(game.homeScore - game.awayScore);
  const score = `${winningTeam.score} to ${losingTeam.score}`;
  const maybeScore = randNth([score,""]);
  const inverseScore = `${losingTeam.score} to ${winningTeam.score}`;
  const maybeInverseScore = randNth([inverseScore, ""]);
  const isBlowout = scoreDifference > 3;
  const isNailbiter = scoreDifference < 3;
  return {
    winningTeam, losingTeam, scoreDifference,
    score, maybeScore, inverseScore, maybeInverseScore,
    isBlowout, isNailbiter
  };
}

function getGameOverCommentary(game) {
  let gameOverComments = [
    "This game is over."
  ];
  if (Math.random() < 0.4) {
    gameOverComments.push(`The ${getWeather(game)} weather might have influenced the outcome.`);
    gameOverComments.push(`Things might have gone differently if not for the ${getWeather(game)} weather.`);
    gameOverComments.push(`At least the weather wasn't ${randNth(allWeathers.filter(w => w !== getWeather(game)))}.`);
  }
  if (Math.random() < 0.166) {
    gameOverComments.push(baalgameCommentaryGrammar.flatten("#onetimepad#"));
  }

  // time until next game
  if (Math.random() < 0.1) {
    var today = new Date();
    var minutes = today.getUTCMinutes();
    let next_game_wait_time = 60 - minutes;
    gameOverComments.push(`The next game is expected to start in ${next_game_wait_time} minutes.`);
    gameOverComments.push(`There are ${next_game_wait_time} minutes until the next game.`);
    gameOverComments.push(`The next game starts in ${next_game_wait_time} minutes.`);
  }

  // who won?
  const {
    winningTeam, losingTeam, scoreDifference,
    score, maybeScore, inverseScore, maybeInverseScore,
    isBlowout, isNailbiter
  } = getScoreState(game);

  // generic remarks
  gameOverComments.push(`The ${winningTeam.name} beat the ${losingTeam.name} ${maybeScore}.`);
  gameOverComments.push(`The ${winningTeam.nick} beat the ${losingTeam.nick} ${maybeScore}.`);
  gameOverComments.push(`The ${losingTeam.name} lost to the ${winningTeam.name} ${maybeInverseScore}.`);
  gameOverComments.push(`The ${losingTeam.nick} lost to the ${winningTeam.nick} ${maybeInverseScore}.`);
  gameOverComments.push(`The score was ${score}.`);
  gameOverComments.push(`The final score was ${score}.`);
  //gameOverComments.push(`${winningTeam.nick} hitter ${winningTeam.batter} played a role in the victory.`);
  gameOverComments.push(`${winningTeam.nick} pitcher ${winningTeam.pitcher} played a role in the victory.`);
  //gameOverComments.push(`${losingTeam.nick} hitter ${losingTeam.batter} played a role in the loss.`);
  gameOverComments.push(`${losingTeam.nick} pitcher ${losingTeam.pitcher} played a role in the loss.`);
  if (Math.random() > 0.5) gameOverComments.push(`The ${winningTeam.nick} won.`);
  if (Math.random() > 0.5) gameOverComments.push(`The ${winningTeam.name} won.`);
  if (Math.random() > 0.5) gameOverComments.push(`The ${losingTeam.nick} lost.`);
  if (Math.random() > 0.5) gameOverComments.push(`The ${losingTeam.name} lost.`);

  // blowouts and nailbiters
  if (isBlowout) {
    const absolutely = randNth(["absolutely", "completely", "utterly", "", "", "", ""]);
    const beat = randNth(["destroyed", "demolished", "eradicated", "routed", "smashed"]);
    const destroyed = absolutely + " " + beat;
    gameOverComments.push(`The ${winningTeam.name} ${destroyed} the ${losingTeam.name} ${maybeScore}`);
    gameOverComments.push(`The ${winningTeam.nick} ${destroyed} the ${losingTeam.nick} ${maybeScore}`);
    gameOverComments.push("It wasn't even close.");
    gameOverComments.push("What a blowout!");
  }
  else if (isNailbiter) {
    const narrowly = randNth(["narrowly", "barely"]);
    const beat = randNth(["beat", "eked out a win over", "eked out victory over", "pulled out a win against"]);
    const narrowlyBeat = narrowly + " " + beat;
    gameOverComments.push(`The ${winningTeam.name} ${narrowlyBeat} the ${losingTeam.name} ${maybeScore}`);
    gameOverComments.push(`The ${winningTeam.nick} ${narrowlyBeat} the ${losingTeam.nick} ${maybeScore}`);
    gameOverComments.push("It was a close game.");
    gameOverComments.push("What a nailbiter!");
    gameOverComments.push("What a close game!");
  }

  // high-scoring and low-scoring games
  if (winningTeam.score > 9) {
    gameOverComments.push(`It was a very high-scoring game.`)
  }
  if (winningTeam.score > 9 && losingTeam.score > 7) {
    gameOverComments.push(`Both teams racked up exceptionally high scores.`);
  }
  if (winningTeam.score < 4) {
    gameOverComments.push(`It was a very low-scoring game.`);
  }

  // shame
  if (game.shame) {
    const utterly = randNth(["completely", "utterly", "", ""]);
    gameOverComments = gameOverComments.concat([
      "What a shameful display!",
      `The ${game.awayTeamName} were ${utterly} shamed.`,
      `The ${game.awayTeamNickname} were ${utterly} shamed.`,
      `The ${game.homeTeamName} ${utterly} shamed the ${game.awayTeamName}.`,
      `The ${game.homeTeamNickname} ${utterly} shamed the ${game.awayTeamNickname}.`
    ]);
  }

  return randNth(gameOverComments);
}

function getBetweenGamesCommentary(game) {
  const chance = Math.random();
  if (chance < 0.2) {
    return ""; // less commentary between games
  }
  else if (chance < 0.5) {
    return getGameOverCommentary(game);
  }
  else if (chance < 0.7) {
    var today = new Date();
    var minutes = today.getUTCMinutes();
    let next_game_wait_time = 60 - minutes;
    return `There are ${next_game_wait_time} minutes until the next game.`;
  }
  else if (chance < 0.95) {
    return getWeatherCommentary(game).split('weather is').join('weather was');
  }
  else {
    return getCannedCommentary();
  }
}

function getCommentary(game) {
  if (game.gameComplete) {
    return getBetweenGamesCommentary(game);
  }

  if (Math.random() < 0.7) {
    // always-allowable comments
    let possibleComments = [
      //"blaseball",
      `The score is ${game.awayScore} to ${game.homeScore}.`,
      `The score is ${game.awayScore} to ${game.homeScore}.`,
      `The score is ${game.awayTeamNickname} ${game.awayScore} to ${game.homeTeamNickname} ${game.homeScore}.`,
      `The score is ${game.awayTeamNickname} ${game.awayScore} to ${game.homeTeamNickname} ${game.homeScore}.`,
      `The count is ${game.atBatBalls} and ${game.atBatStrikes}.`,
      `The count is ${game.atBatBalls} and ${game.atBatStrikes} with ${game.halfInningOuts} outs.`,
      `There are ${game.baserunnerCount} runners on base.`,
      `You are listening to ${game.awayTeamNickname} at ${game.homeTeamNickname}.`,
      `You are listening to ${game.awayTeamName} at ${game.homeTeamName}.`,
      getWeatherCommentary(game)
    ];

    // score comments
    const {
      winningTeam, losingTeam, scoreDifference,
      score, maybeScore, inverseScore, maybeInverseScore,
      isBlowout, isNailbiter
    } = getScoreState(game);
    // generic score comments
    possibleComments.push(`The ${winningTeam.name} are ahead ${score}`);
    possibleComments.push(`The ${winningTeam.nick} are ahead ${score}`);
    // high-scoring and low-scoring games
    if (winningTeam.score > 9) {
      possibleComments.push(`This is a very high-scoring game.`)
    }
    if (winningTeam.score > 9 && losingTeam.score > 7) {
      possibleComments.push(`Both teams have racked up exceptionally high scores.`);
    }
    if (winningTeam.score < 4) {
      possibleComments.push(`This is a very low-scoring game so far.`);
    }
    // blowouts and nailbiters
    if (isBlowout) {
      const absolutely = randNth(["absolutely", "completely", "utterly", "", "", "", ""]);
      const beat = randNth(["destroying", "demolishing", "eradicating", "routing", "smashing"]);
      const destroyed = absolutely + " " + beat;
      possibleComments.push(`The ${winningTeam.name} are ${destroyed} the ${losingTeam.name} ${maybeScore}`);
      possibleComments.push(`The ${winningTeam.nick} are ${destroyed} the ${losingTeam.nick} ${maybeScore}`);
      possibleComments.push("This isn't even close.");
      possibleComments.push("It isn't even close.");
      possibleComments.push("What a blowout!");
    }
    else if (isNailbiter) {
      const narrowly = randNth(["narrowly", "barely"]);
      possibleComments.push(`The ${winningTeam.name} are ${narrowly} ahead ${maybeScore}`);
      possibleComments.push("This is a close game.");
      possibleComments.push("What a nailbiter!");
      possibleComments.push("What a close game!");
    }


    // comments on the base state
    const basesState = getBasesState(game);
    const baseStateCommentary = getBaseStateCommentary(game, basesState);
    possibleComments.push(baseStateCommentary);
    const numBasesOccupied = basesState.filter(it => it).length;
    for (let i = 0; i < numBasesOccupied * 2; i++) {
      possibleComments.push(baseStateCommentary); // higher weight the more bases have runners on them
    }

    // comments on the inning state
    if (game.topOfInning) {
      possibleComments = possibleComments.concat([
        `${randNth(["It is the","It's the",""])} top of the ${game.inning+1}th.`,
        `${game.homePitcherName} is pitching for the ${randNth([game.homeTeamNickname, game.homeTeamName])}.`,
        `${game.homePitcherName} ${randNth(["is",""])} on the mound.`
      ]);
      if (game.awayBatterName) {
        possibleComments = possibleComments.concat([
          `${game.awayBatterName} is batting for the ${randNth([game.awayTeamNickname, game.awayTeamName])}.`,
          `${game.awayBatterName} ${randNth(["is",""])} at bat.`
        ]);
      }
    }
    else {
      possibleComments = possibleComments.concat([
        `${randNth(["It is the","it's the",""])} bottom of the ${game.inning+1}th.`,
        `${game.awayPitcherName} is pitching for the ${randNth([game.awayTeamNickname, game.awayTeamName])}.`,
        `${game.awayPitcherName} ${randNth(["is",""])} on the mound.`
      ]);
      if (game.homeBatterName) {
        possibleComments = possibleComments.concat([
          `${game.homeBatterName} is batting for the ${randNth([game.homeTeamNickname, game.homeTeamName])}.`,
          `${game.homeBatterName} ${randNth(["is",""])} at bat.`
        ]);
      }
    }

    // comments on the shame state
    if (game.shame) {
      const utterly = randNth(["completely", "utterly", "", ""]);
      possibleComments = possibleComments.concat([
        "What a shameful display!",
        `The ${game.awayTeamName} has been ${utterly} shamed.`,
        `The ${game.awayTeamNickname} has been ${utterly} shamed.`,
        `The ${game.awayTeamName} are hanging their heads in shame right now.`,
        `The ${game.awayTeamNickname} are hanging their heads in shame right now.`,
        `The ${game.homeTeamName} have ${utterly} shamed the ${game.awayTeamName}.`,
        `The ${game.homeTeamNickname} have ${utterly} shamed the ${game.awayTeamNickname}.`
      ]);
    }

    // return one at random from the weighted array
    return randNth(possibleComments);
  } else {
     return getCannedCommentary();
  }
}

const updateRateSeconds = 1.1;
const minSecondsBetweenSwitches = 60;//20
const maxSecondsBetweenSwitches = 120;//30
const chanceToSwitchPerSecond = 1/30;
const commentaryRate = 0.5;

let timeOfLastSimDataGrab = 0;
let simDataGrabInterval = 900;
let secondsSinceLastSwitch = 0;
let currentGameID = null;

let currentSeason = null;
let currentDay = null;

const lastUpdates = {};

function updateGameData(season, day) {
  let date_now = Date.now()
  var today = new Date();
  var minutes = today.getUTCMinutes();
  let next_game_wait_time = 60 - minutes;
  if ((date_now - timeOfLastSimDataGrab) > (simDataGrabInterval * 1000.0) ||
      (next_game_wait_time < 1.5) ||
      ((next_game_wait_time > 59) && ((date_now - timeOfLastSimDataGrab) > (5.0 * 1000.0) ))) {
     timeOfLastSimDataGrab = date_now;
     getEndpoint('simulationData', {}, (data, err) => {
        if(err) {
           return; // panic, but not very much
        }
        const seasonHeader = `Season ${data.season + 1}, Day ${data.day + 1}`;
        speak(seasonHeader);
        currentDay = data.day;
        currentSeason = data.season;
     });
  }
  if(currentSeason) { season = currentSeason; }
  if(currentDay) { day = currentDay; }

  secondsSinceLastSwitch += updateRateSeconds;
  getEndpoint('games', {season, day}, function(games, err) {
    // if there's an error, fail gracefully
    if (err) {
      // maybe reset switch state to force a switch to a new game when we go back online?
      //secondsSinceLastSwitch = 0;
      //currentGameID = null;
      // for now, as a stopgap, say something random that doesn't depend on game state
      speak(getCannedCommentary());
      return;
    }

    // otherwise assume we've got the game data and go ahead
    const okToSwitch = secondsSinceLastSwitch > minSecondsBetweenSwitches;
    const mustSwitch = currentGameID === null || secondsSinceLastSwitch > maxSecondsBetweenSwitches;
    const switchGame = mustSwitch || (okToSwitch && (Math.random() < chanceToSwitchPerSecond));
    let possibleNextGames = games;
    if (switchGame) {
      console.log("SWITCHING TEAMS");
      let possibleNextGames = games;
      if (!games.every(game => game.gameComplete)) {
        possibleNextGames = possibleNextGames.filter(game => !game.gameComplete);
      }
      if (possibleNextGames.length > 1) {
        possibleNextGames = possibleNextGames.filter(game => game._id !== currentGameID);
      }
      secondsSinceLastSwitch = 0;
      const possibleNextGameIDs = possibleNextGames.map(game => game._id);
      currentGameID = randNth(possibleNextGameIDs);
    }
    const game = games.find(game => game._id === currentGameID) || games[0];
    const title = `${game.awayTeamName} at ${game.homeTeamName}, ${game.awayScore} to ${game.homeScore}`;
    if (switchGame) {
      const prefix = randNth(["We go now to the", "Now over to the", "Over to the", "Now back to the"]);
      speakHighPriority(`${prefix} ${title}.`);
    }
    if (game.lastUpdate !== lastUpdates[game._id]) {
      speak(game.lastUpdate);
      lastUpdates[game._id] = game.lastUpdate;
    }
    else {
      if (Math.random() < commentaryRate) {
         try {
            const commentary = getCommentary(game);
            speak(commentary);
         } catch(err) {
            console.log(err);
            speak("The Shard Is Watching");
         }
      }
    }
  });
}

getEndpoint('simulationData', {}, function(data) {
  const seasonHeader = `Season ${data.season + 1}, Day ${data.day + 1}`;
  speak(seasonHeader);
  setInterval(updateGameData, updateRateSeconds * 1000, data.season, data.day);
  setInterval(pruneSpeechQueue, 20000);
});
