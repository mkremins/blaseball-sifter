const datascript = require("datascript");

const {getEndpoint} = require("./api");
const {partition} = require("./util");

/// database util functions

// Given the DB, return the EID of the most recently added entity.
function newestEID(db){
  // FIXME there is probably a better way to do this
  let allDatoms = datascript.datoms(db, ":eavt");
  return allDatoms[allDatoms.length - 1].e;
}

// Given the DB and an EID, retrieve the corresponding entity as an object.
// This is what `datascript.entity(db, eid)` SHOULD do, but for some reason doesn't.
function getEntity(db, eid) {
  let propValuePairs = datascript.q("[:find ?prop ?val :where [" + eid + " ?prop ?val]]", db);
  if (propValuePairs.length === 0) return null;
  let entity = {":db/id": eid};
  for (let [prop, val] of propValuePairs) {
    entity[prop] = val;
  }
  return entity;
}

// Given the DB and an entity, return an updated DB with the entity added.
function createEntity(db, entity) {
  // TODO assert entity is an object with only valid DB values
  entity[":db/id"] = -1;
  return datascript.db_with(db, [entity]);
}

// Given the DB, an EID, a property to update, and a value, return an updated DB
// with the property set to the given value in the specified entity.
function updateProperty(db, eid, prop, val) {
  // TODO assert eid is a valid EID, prop is a string, val is a valid DB value
  return datascript.db_with(db, [[":db/add", eid, prop, val]]);
}

// Given the DB, an EID, and an object of properties to update, return an updated DB
// with the properties set to the given values in the specified entity.
function updateProperties(db, eid, props) {
  for (let prop of Object.keys(props)) {
    db = updateProperty(db, eid, prop, props[prop]);
  }
  return db;
}

// Given the DB, an EID, a property to update, and a value, return an updated DB
// without the specified property.
function deleteProperty(db, eid, prop, val) {
  // TODO assert eid is a valid EID, prop is a string, val is a valid DB value
  return datascript.db_with(db, [[":db/retract", eid, prop, val]]);
}

// Given the DB and an EID, return an updated DB with the specified entity removed.
function deleteEntity(db, eid) {
  return datascript.db_with(db, [[":db/retractEntity", eid]]);
}

/// actual stuff we care about

let schema = {};
let cardinalityManyAttrs = [
  // our own attrs
  "eventType",
  // attrs directly from blaseball
  "lineup", "rotation", "bullpen", "bench",
  "seasAttr", "permAttr", "weekAttr", "gameAttr",
  "outcome"
];
for (let attr of cardinalityManyAttrs) {
  schema[attr] = {":db/cardinality": ":db.cardinality/many"};
}
let appDB = datascript.empty_db(schema);

function addObjectToDB(obj) {
  const tx = [];
  for (let key of Object.keys(obj)) {
    const val = obj[key];
    if (val === null) continue;
    if (Array.isArray(val) && cardinalityManyAttrs.includes(key)) {
      for (let subval of val) {
        tx.push([":db/add", -1, key, subval]);
      }
    }
    else {
      tx.push([":db/add", -1, key, val]);
    }
  }
  appDB = datascript.db_with(appDB, tx);
}

function populateTeams(teams) {
  for (let team of teams) {
    team.type = "team";
    addObjectToDB(team);
  }
  populatePlayers();
}

function populatePlayers() {
  const allPlayerIDs = datascript.q(
    `[:find ?playerID :where (or [?someTeam "lineup" ?playerID]
                                 [?someTeam "rotation" ?playerID]
                                 [?someTeam "bullpen" ?playerID]
                                 [?someTeam "bench" ?playerID])])]`,
  appDB).map(res => res[0]);

  const batches = partition(allPlayerIDs, 60);
  for (let batch of batches) {
    getEndpoint("players", {ids: batch.join(",")}, function(data, err) {
      if (err) {
        console.log("⚠️ getting batch of players failed!", err);
        return;
      }
      console.log(`Got batch of ${data.length} players!`);
      for (let player of data) {
        player.type = "player";
        addObjectToDB(player);
      }
    });
  }
}

function classifyEvent(game) {
  const classifiers = [
    // game lifecycle
    {eventType: ["startInningTop", "startInningHalf"], substring: "Top of"},
    {eventType: ["startInningBottom", "startInningHalf"], substring: "Bottom of"},
    {eventType: ["changeBatter"], substring: "batting for the"},
    {eventType: ["gameOver"], substring: "Game over."},
    // progress toward scoring
    {eventType: ["homeRun", "hit", "batterAdvances", "advance", "good"], substring: "home run!"},
    {
      eventType: ["hitTriple", "hit", "batterAdvances", "advance", "good"],
      substring: "hits a Triple!"
    },
    {
      eventType: ["hitDouble", "hit", "batterAdvances", "advance", "good"],
      substring: "hits a Double!"
    },
    {
      eventType: ["hitSingle", "hit", "batterAdvances", "advance", "good"],
      substring: "hits a Single!"
    },
    {eventType: ["walk", "batterAdvances", "advance", "good"], substring: "draws a walk"},
    {eventType: ["ball", "good"], substring: "Ball."}, // progress toward a walk apparently!
    {eventType: ["steal", "otherAdvances", "advance", "good"], substring: "steals"},
    {
      // TODO who actually scored? should probably grab that
      eventType: ["hitSacrificeFly", "otherAdvances", "advance", "good"],
      substring: "hit a sacrifice fly"
    },
    // strikes, fouls, etc
    {eventType: ["strikeLooking", "strike", "bad"], substring: "Strike, looking."},
    {eventType: ["strikeSwinging", "strike", "bad"], substring: "Strike, swinging."},
    {eventType: ["foul", "bad"], substring: "Foul Ball."},
    // hitter outs
    {eventType: ["hitGroundOut", "batterOut", "out", "bad"], substring: "hit a ground out to"},
    {eventType: ["hitFlyOut", "batterOut", "out", "bad"], substring: "hit a flyout to"},
    {
      eventType: ["strikeOutSwinging", "batterOut", "strikeOut", "strike", "out", "bad"],
      substring: "struck out swinging"
    },
    {
      eventType: ["strikeOutLooking", "batterOut", "strikeOut", "strike", "out", "bad"],
      substring: "strikes out looking"
    },
    // other outs (TODO record who got out?)
    {
      eventType: ["caughtStealing", "otherOut", "out", "bad"],
      substring: "gets caught stealing"
    },
    {
      eventType: ["fieldersChoice", "otherOut", "out", "bad"],
      substring: "reaches on fielder's choice."
    },
    // ambiance (this is hilariously incomplete lmao)
    {eventType: ["ambianceBirds", "ambiance"], substring: "The birds continue to stare."},
    {eventType: ["ambianceBirds", "ambiance"], substring: "There's just too many birds!"},
    {eventType: ["ambiancePlayBall", "ambiance"], substring: "Play ball!"}, // maybe lifecycle?
  ];
  for (let classifier of classifiers) {
    if (classifier.substring && game.lastUpdate.includes(classifier.substring)) {
      return classifier.eventType;
    }
    if (classifier.regex && classifier.regex.match(game.lastUpdate)) {
      return classifier.eventType;
    }
  }
  return ["other"];
}

let previousGameStates = {};

function pushEvent(game) {
  game.type = "event";
  game.eventType = classifyEvent(game);
  game.game = game.id; // so we can write more understandable queries

  // check for new outcomes in this event
  const prevGame = previousGameStates[game.id];
  const prevOutcomes = prevGame ? prevGame.outcomes : [];
  if (prevOutcomes.length < game.outcomes.length) {
    for (let i = prevGame.outcomes.length - 1; i < game.outcomes.length; i++) {
      const outcome = game.outcomes[i];
      // classify the outcome
      if (outcome.startsWith("Rogue Umpire incinerated")) {
        game.eventType.push("incineration");
        const regex = /^Rogue Umpire incinerated (.*) (?:hitter|pitcher) (.*)! Replaced by (.*)$/;
        const match = outcome.match(regex);
        game.incineratedName = match[2];
        game.replacementName = match[3];
      }
    }
  }
  previousGameStates[game.id] = game;

  addObjectToDB(game); // for now
  /*
  const tx = [
    [":db/add", -1, "type", "event"],
    [":db/add", -1, "season", game.season],
    [":db/add", -1, "day", game.day],
    [":db/add", -1, "inning", game.inning],
    [":db/add", -1, "home", game.homeTeamName],
    [":db/add", -1, "away", game.awayTeamName],
    [":db/add", -1, "", game.lastUpdate]
  ];
  */
}

function query(queryStr, ...params) {
  return datascript.q(queryStr, appDB, ...params);
}

function getEntitiesByType(type) {
  const datoms = query(`[:find ?e ?a ?v :in $ ?t :where [?e "type" ?t] [?e ?a ?v]]`, type);
  const entities = {};
  for (let [eid, attr, val] of datoms) {
    const entity = entities[eid] = entities[eid] || {eid};
    if (cardinalityManyAttrs.includes(attr)) {
      entity[attr] = entity[attr] || [];
      entity[attr].push(val);
    }
    else {
      entity[attr] = val;
    }
  }
  return entities;
}

module.exports = {
  populateTeams,
  pushEvent,
  query,
  getEntitiesByType,
};
