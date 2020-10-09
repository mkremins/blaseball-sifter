
const blaseballBaseURL = "https://cors-proxy.blaseball-reference.com/database"; // "https://blaseball.com/database";

function getEndpoint(endpoint, params, cb) {
  const paramsStr = Object.keys(params).map(key => key + "=" + params[key]).join("&");

  const url = `${blaseballBaseURL}/${endpoint}?${paramsStr}`;
  console.log("Fetching url:", url);
  fetch(url, { headers:{'X-Requested-With': 'mkremins/blaseball-sifter'}})
  .then(response => response.json())
  .then(data => {
    console.log('Fetch success:', data);
    cb(data)
  })
  .catch((error) => {
    console.error('Fetch error:', error);
    cb(null, error)
  });
}
