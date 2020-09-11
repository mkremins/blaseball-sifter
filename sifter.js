const database = require("./database");
const {distinct} = require("./util");

/// parse sifting patterns (lightly modified from Felt)

const queryRuleNames = [];

function findLvars(s) {
  return s.match(/\?[a-zA-Z_][a-zA-Z0-9_]*/g).map(lvar => lvar.substring(1));
}

// Given part of a sifting pattern, return it, wrapping it in quotes if necessary.
function quotewrapIfNeeded(part) {
  if (part[0] === '?') return part;
  if (['true','false','nil'].indexOf(part) > -1) return part;
  if (!Number.isNaN(parseFloat(part))) return part;
  if (part.length >= 2 && part[0] === '"' && part[part.length - 1] === '"') return part;
  return '"' + part + '"';
}

function parseSiftingPatternClause(line) {
  line = line.trim();
  let lvars = distinct(findLvars(line));
  let parts = line.split(/\s+/);
  let clauseStr = line;
  if (line[0] === '(') {
    // handle complex clause
    // can be `(or ...)`, `(not ...)`, `(not-join ...)`, `(pred arg*)`, `(rule arg*)`, `(function arg*) result`
    const clauseHead = parts[0].substring(1);
    if (['or', 'not', 'not-join'].indexOf(clauseHead) > -1) {
      // don't export lvars from `or`, `not`, `not-join` clauses
      lvars = [];
    } else if (queryRuleNames.indexOf(clauseHead) > -1) {
      // don't wrap in square brackets
    } else {
      clauseStr = '[' + line + ']';
    }
  } else {
    // handle simple clause: `eid attr? value?`
    if (parts.length < 1 || parts.length > 3) {
      console.warn('Invalid query line: ' + line);
    }
    clauseStr = '[' + parts.map(quotewrapIfNeeded).join(' ') + ']';
  }
  return {clauseStr: clauseStr, lvars: lvars, original: line};
}

function chunkClauses(str) {
  const stack = [];
  const splitPoints = [0];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "[") {
      //if (stack.length === 0) splitPoints.push(i); // unbracketed stuff at the top level is fine
      stack.push("]");
    }
    else if (char === "(") {
      //if (stack.length === 0) splitPoints.push(i); // unbracketed stuff at the top level is fine
      stack.push(")");
    }
    else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) splitPoints.push(i + 1);
    }
    else if (char === "]" || char === ")") {
      throw Error(`unbalanced ${char}`);
    }
  }
  const clauseStrs = [];
  for (let i = 0; i < splitPoints.length - 1; i++) {
    clauseStrs.push(str.substring(splitPoints[i], splitPoints[i + 1]));
  }
  // Note the .replace calls here to strip simple clauses of leading/trailing square brackets,
  // which parseSiftingPatternClause then immediately adds back on.
  // We strip them here because Felt was originally designed to receive a sifting pattern
  // as "lines" (i.e. an array of strings, one string per clause),
  // and in the lines format, wrapping a simple [e a v] clause with brackets is redundant,
  // so the other parsing functions assume the brackets aren't present (and break if they are).
  // In the future we should probably do something about this.
  return clauseStrs.map(s => s.trim().replace(/^\[/, "").replace(/\]$/, ""));
}

function parseSiftingPattern(lines) {
  if (typeof lines === "string") {
    lines = chunkClauses(lines);
  }
  let clauses = lines.map(parseSiftingPatternClause);
  let lvars = [];
  for (let clause of clauses) {
    lvars = lvars.concat(clause.lvars);
  }
  lvars = distinct(lvars);
  let findPart = lvars.map(lvar => '?' + lvar).join(' ');
  let wherePart = clauses.map(clause => clause.clauseStr).join();
  let query = `[:find ${findPart} :in $ :where ${wherePart}]`; // TODO add % back to :in clause when we pass rules
  return {lvars: lvars, clauses: clauses, query: query, findPart: findPart, wherePart: wherePart};
}

/// run sifting patterns (lightly modified from Felt)

function runSiftingPattern(pattern) {
  if (!pattern.query || !pattern.lvars) {
    throw Error("Invalid sifting pattern!", pattern);
  }
  const results = database.query(pattern.query);
  const nuggets = results.map(function(result) {
    let vars = {};
    for (let i = 0; i < pattern.lvars.length; i++) {
      vars[pattern.lvars[i]] = result[i];
    }
    return {pattern, vars};
  });
  return nuggets;
}

/// actual sifting pattern definitions

const rawSiftingPatterns = [
  {
    name: "testPattern",
    pattern: `[?e1 eventType changeBatter] [?e2 eventType strike]
              [?e1 game ?game] [?e2 game ?game]
              (< ?e1 ?e2)`
  }
];

const siftingPatterns = rawSiftingPatterns.map(({name, pattern}) => {
  pattern = parseSiftingPattern(pattern);
  pattern.name = name;
  return pattern;
});

function runSiftingPatterns() {
  for (let pattern of siftingPatterns) {
    const nuggets = runSiftingPattern(pattern);
    if (nuggets.length > 0) {
      console.log("Found matches for pattern: " + pattern.name);
      for (let nugget of nuggets) {
        console.log(nugget.vars);
      }
    }
  }
}

module.exports = {runSiftingPatterns};
