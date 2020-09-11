/// util

function randNth(items){
  return items[Math.floor(Math.random()*items.length)];
}

function partition(list, partitionSize) {
  const partitions = [];
  let currPartition = [];
  for (let item of list) {
    currPartition.push(item);
    if (currPartition.length >= partitionSize) {
      partitions.push(currPartition);
      currPartition = [];
    }
  }
  if (currPartition.length > 0) {
    partitions.push(currPartition);
  }
  return partitions;
}

// from https://gist.github.com/andrei-m/982927
// Compute the edit distance between the two given strings
function getEditDistance(a, b){
  if(a.length == 0) return b.length;
  if(b.length == 0) return a.length;

  var matrix = [];

  // increment along the first column of each row
  var i;
  for(i = 0; i <= b.length; i++){
    matrix[i] = [i];
  }

  // increment each column in the first row
  var j;
  for(j = 0; j <= a.length; j++){
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) == a.charAt(j-1)){
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
                                Math.min(matrix[i][j-1] + 1, // insertion
                                         matrix[i-1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
};

function getNormalizedEditDistance(a, b) {
  const editDistance = getEditDistance(a, b);
  return editDistance / Math.max(a.length, b.length);
}

module.exports = {
  randNth,
  partition,
  getEditDistance,
  getNormalizedEditDistance
};
