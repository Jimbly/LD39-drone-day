/*jshint browser:true, noempty:false*/
/*global $: false */

const PLAYER_NAME_KEY = 'ld.player_name';
const SCORE_KEY = 'LD39';
const LS_KEY = SCORE_KEY.toLowerCase();

export let need_update = false;

export let player_name;
if (localStorage[PLAYER_NAME_KEY]) {
  player_name = localStorage[PLAYER_NAME_KEY];
} else {
  localStorage[PLAYER_NAME_KEY] = player_name = 'Anonymous ' + Math.random().toString().slice(2, 8);
}

let score_host = 'http://scores.dashingstrike.com';
if (window.location.host.indexOf('localhost') !== -1 ||
  window.location.host.indexOf('staging') !== -1) {
  score_host = 'http://scores.staging.dashingstrike.com';
}
const score_mod = 10000000;
const score_turns_inv = 1000;
// Score encoding: want larger encoded value to be "better"
// Here, lower turns, higher net_worth
function parseHighScore(score) {
  let turns = score_turns_inv - Math.floor(score / score_mod);
  let net_worth = score % score_mod;
  return { turns, net_worth };
}
function encodeScore(score) {
  return (score_turns_inv - score.turns) * score_mod + score.net_worth;
}
export function formatScore(score) {
  return `${score.turns} turn${(score.turns === 1) ? '' : 's'}, \$${score.net_worth}`;
}
export function formatName(score) {
  if (score.name.indexOf('Anonymous') === 0) {
    return score.name.slice(0, 'Anonymous'.length);
  }
  return score.name;
}

let num_highscores = 20;
let score_update_time = 0;
export let high_scores = {};
function refreshScores(level, changed_cb) {
  $.ajax({ url: `${score_host}/api/scoreget?key=${SCORE_KEY}.${level}&limit=${num_highscores}`, success: function (scores) {
    let list = [];
    scores.forEach(function (score) {
      score.score = parseHighScore(score.score);
      list.push(score);
    });
    high_scores[level] = list;
    if (changed_cb) {
      changed_cb();
    }
  }});
}


function clearScore(level, old_player_name, cb) {
  if (!old_player_name) {
    return;
  }
  $.ajax({ url: `${score_host}/api/scoreclear?key=${SCORE_KEY}.${level}&name=${old_player_name}`, success: cb});
}

function submitScore(level, score, cb) {
  if (!score || !score.turns || !score.net_worth) {
    return;
  }
  let high_score = encodeScore(score);
  if (!player_name) {
    return;
  }
  $.ajax({ url: `${score_host}/api/scoreset?key=${SCORE_KEY}.${level}&name=${player_name}&score=${high_score}`, success: function (scores) {
    let list = [];
    scores.forEach(function (score) {
      score.score = parseHighScore(score.score);
      list.push(score);
    });
    high_scores[level] = list;
    if (cb) {
      cb();
    }
  }});
}

export function updateHighScores(level_defs, changed_cb) {
  let now = Date.now();
  if (now - score_update_time > 5*60*1000 || need_update) {
    need_update = false;
    score_update_time = now;
    for (let ii = 0; ii < level_defs.length; ++ii) {
      refreshScores(level_defs[ii].name, changed_cb);
    }
  }
}


function saveScore(ld, obj, cb) {
  ld.local_score = obj;
  let key = `${LS_KEY}.score_${ld.name}`;
  localStorage[key] = JSON.stringify(obj);
  submitScore(ld.name, obj, function () {
    obj.submitted = true;
    if (obj === ld.local_score) {
      localStorage[key] = JSON.stringify(obj);
    }
    if (cb) {
      cb();
    }
  });
}

export function getScore(ld) {
  let key = `${LS_KEY}.score_${ld.name}`;
  if (localStorage && localStorage[key]) {
    let ret = JSON.parse(localStorage[key]);
    if (!ret) {
      return;
    }
    if (ret && !ret.submitted) {
      saveScore(ld, ret);
    }
    return ret;
  }
  return null;
}

export function setScore(ld, turns, net_worth) {
  if (!ld.local_score || turns < ld.local_score.turns || turns === ld.local_score.turns && net_worth > ld.local_score.net_worth) {
    // better
    let obj = { turns, net_worth };
    saveScore(ld, obj);
  }
}

export function updatePlayerName(level_defs, new_player_name) {
  if (new_player_name === player_name) {
    return;
  }
  let old_name = player_name;
  localStorage[PLAYER_NAME_KEY] = player_name = new_player_name;
  level_defs.forEach(function (ld) {
    if (ld.local_score) {
      if (old_name.indexOf('Anonymous') === 0) {
        // Only wiping old scores if anonymous, so we can't delete other people's scores!
        clearScore(ld.name, old_name, function () {
          saveScore(ld, ld.local_score, function () {
            need_update = true;
          });
        });
      }
    }
  });
}
