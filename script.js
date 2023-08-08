// Get DOM elements
const queryForm = document.getElementById('queryForm');
const resultsTable = document.getElementById('resultsTable');

// Listen for form submission
queryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const latitudesInput = document.getElementById('latitudes');
  const longitudesInput = document.getElementById('longitudes');
  const uniqueIdsInput = document.getElementById('uniqueIds');
  
  const latitudesArray = latitudesInput.value
    .trim()
    .split('\n');
  
  const longitudesArray = longitudesInput.value
    .trim()
    .split('\n');

  const uniqueIdsArray = uniqueIdsInput.value
    .trim()
    .split('\n');

  fetchPlacesData(latitudesArray, longitudesArray, uniqueIdsArray);
});

function fetchPlacesData(latitudesArray, longitudesArray, uniqueIdsArray) {
  const queries = [
    'school', 'college', 'business park', 'office', 'hospital',
    'society', 'mall', 'theater', 'restaurant', 'hotel', 'shop', 'transit'
  ];

  const coordinatesArray = [];

  for (let i = 0; i < latitudesArray.length && i < longitudesArray.length; i++) {
    const latitude = latitudesArray[i].trim();
    const longitude = longitudesArray[i].trim();

    if (latitude && longitude) {
      coordinatesArray.push([latitude, longitude]);
    }
  }

  coordinatesArray.forEach((coordinates, index) => {
    const uniqueId = uniqueIdsArray[index].trim() || `ID-${index + 1}`;
    const promises = queries.map(query => {
      return fetchPlacesByQuery(query, coordinates);
    });

    Promise.all(promises)
      .then(results => displayResults(results, coordinates, uniqueId, index === 0))
      .catch(error => console.error(error));
  });
}

function fetchPlacesByQuery(query, coordinates, nextPageToken = null) {
  const [latitude, longitude] = coordinates;
  let apiUrl = `https://corsproxy.io/?https://maps.googleapis.com/maps/api/place/textsearch/json?key={YOUR_API_KEY}&query=${query}&location=${latitude},${longitude}`;

  if (nextPageToken) {
    apiUrl += `&pagetoken=${nextPageToken}`;
  }

  return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      let results = data.results;

      if (data.next_page_token) {
        return fetchPlacesByQuery(query, coordinates, data.next_page_token)
          .then(nextPageResults => {
            results = results.concat(nextPageResults);
            return results;
          });
      }

      return results;
    })
    .then(results => calculateMinimumDistance(results, coordinates))
    .then(minDistance => ({ query, minDistance }));
}

function calculateMinimumDistance(results, coordinates) {
  const distances = results.map(result => {
    if (result.geometry && result.geometry.location) {
      const placeLocation = result.geometry.location;
      const distance = getDistance(coordinates, [placeLocation.lat, placeLocation.lng]);
      return distance * 1000;
    }
    return Infinity; // Assign a large value if location data is missing
  });

  return Math.min(...distances);
}

function getDistance(coord1, coord2) {
  const [lat1, lon1] = coord1.map(parseFloat);
  const [lat2, lon2] = coord2.map(parseFloat);
  const earthRadius = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Create a variable to keep track of the current row index
let rowIndex = 0;
let responseCount = 0;

function displayResults(results, coordinates, uniqueId, clearTable) {
  // Increment the response count for each set of results received
  responseCount++;

  if (clearTable && responseCount === 1) {
    // Clear previous table data if it's the first set of results
    resultsTable.innerHTML = '';
    const headersRow = document.createElement('tr');
    headersRow.innerHTML = `
      <th>Unique ID</th>
      <!-- ...other headers... -->
      <th>Transit</th>
    `;
    resultsTable.appendChild(headersRow);
  }

  const locationRow = document.createElement('tr');

  const uniqueIdCell = document.createElement('td');
  uniqueIdCell.textContent = uniqueId;
  locationRow.appendChild(uniqueIdCell);

  const latitudeCell = document.createElement('td');
  latitudeCell.textContent = coordinates[0];
  locationRow.appendChild(latitudeCell);

  const longitudeCell = document.createElement('td');
  longitudeCell.textContent = coordinates[1];
  locationRow.appendChild(longitudeCell);

  results.forEach(result => {
    const distanceCell = document.createElement('td');
    distanceCell.textContent = result.minDistance.toFixed(4);
    locationRow.appendChild(distanceCell);
  });

  // Append the location row at the specific rowIndex
  resultsTable.insertBefore(locationRow, resultsTable.childNodes[rowIndex]);

  // If all responses are received, reset the counter and increment the rowIndex for the next row
  if (responseCount === coordinatesArray.length) {
    responseCount = 0;
    rowIndex++;
  }
}

function exportToExcel() {
  const wb = XLSX.utils.table_to_book(document.getElementById('resultsTable'), { sheet: "SheetJS" });
  const wbout = XLSX.write(wb, { bookType: 'xlsx', bookSST: true, type: 'binary' });
  const filename = "results.xlsx";

  function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) {
      view[i] = s.charCodeAt(i) & 0xFF;
    } 
    return buf;
  }

  try {
    const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
    if (navigator.msSaveBlob) {
      // For IE and Edge
      navigator.msSaveBlob(blob, filename);
    } else {
      // For other browsers
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  } catch (e) {
    console.log("Exporting to Excel failed:", e);
  }
}
