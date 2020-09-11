const request = require("request");

const blaseballBaseURL = "https://blaseball.com/database";

function getEndpoint(endpoint, params, cb) {
  const paramsStr = Object.keys(params).map(key => key + "=" + params[key]).join("&");
  const url = `${blaseballBaseURL}/${endpoint}?${paramsStr}`;
  //console.log(url);
  request({url}, function(err, res, body) {
    if (err) {
      cb(null, err);
    }
    else {
      let parsed;
      try {
        parsed = JSON.parse(body);
      }
      catch (except) {
        //console.log(except);
        cb(null, except);
      }
      cb(parsed);
    }
  });
}

module.exports = {getEndpoint};
