import './style.css';
import L from 'leaflet';

/**
 * Geo Alarm - "Turn Off" Feature
 * Re-arms on re-allocation or leaving range.
 */

// --- Global State ---
let state = {
  userCoords: null,
  targetCoords: null,
  radius: 1000,
  isConfirmed: false,
  isInside: false,
  isAlarmStopped: false,
  watchId: null,
  userMarker: null,
  targetMarker: null,
  targetCircle: null
};

// --- DOM Elements ---
const el = {
  userLatVal: document.getElementById('user-lat-val'),
  userLngVal: document.getElementById('user-lng-val'),
  latVal: document.getElementById('lat-val'),
  lngVal: document.getElementById('lng-val'),
  distVal: document.getElementById('dist-val'),
  proxRow: document.getElementById('proximity-row'),
  proxPill: document.getElementById('proximity-pill'),
  stopBtn: document.getElementById('stop-alarm-btn'),
  radiusContainer: document.getElementById('radius-container'),
  radiusSlider: document.getElementById('radius-slider'),
  radiusDisplay: document.getElementById('radius-display'),
  setBtn: document.getElementById('set-location-btn'),
  editBtn: document.getElementById('edit-location-btn'),
  findBtn: document.getElementById('find-my-location-btn'),
  uploadTrigger: document.getElementById('upload-trigger'),
  audioInput: document.getElementById('audio-input'),
  alarmAudio: document.getElementById('alarm-audio')
};

// --- Map Setup ---
const map = L.map('map', { zoomControl: false }).setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: 'topright' }).addTo(map);

const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

const destIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// --- Logic Helpers ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function handleLocationUpdate(lat, lng) {
  state.userCoords = { lat, lng };
  const latlng = [lat, lng];

  el.userLatVal.textContent = lat.toFixed(6);
  el.userLngVal.textContent = lng.toFixed(6);

  if (!state.userMarker) {
    state.userMarker = L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
    map.flyTo(latlng, 15);
  } else {
    state.userMarker.setLatLng(latlng);
  }

  checkProximity();
}

function checkProximity() {
  if (!state.userCoords || !state.targetCoords || !state.isConfirmed) return;

  const dist = getDistance(
    state.userCoords.lat, state.userCoords.lng,
    state.targetCoords.lat, state.targetCoords.lng
  );

  const distInMeters = Math.round(dist);
  el.distVal.textContent = distInMeters;

  const inRange = dist <= state.radius;

  if (inRange) {
    el.proxPill.textContent = 'IN RANGE';
    el.proxPill.className = 'status-pill in';

    // Play only if NOT stopped
    if (!state.isInside && !state.isAlarmStopped) {
      el.alarmAudio.loop = true;
      el.alarmAudio.play().catch(console.warn);
      state.isInside = true;
    }
  } else {
    el.proxPill.textContent = 'OUT OF RANGE';
    el.proxPill.className = 'status-pill out';
    state.isInside = false;

    // Auto-reset "Stopped" state when leaving range so it re-arms
    if (state.isAlarmStopped) {
      resetAlarmState();
    }
  }
}

function resetAlarmState() {
  state.isAlarmStopped = false;
  el.stopBtn.classList.remove('active');
  el.stopBtn.textContent = 'OFF';
  el.alarmAudio.pause();
  el.alarmAudio.currentTime = 0;
}

// --- Geolocation ---
function startTracking() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => handleLocationUpdate(pos.coords.latitude, pos.coords.longitude),
    (err) => console.error(err),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
  );

  state.watchId = navigator.geolocation.watchPosition(
    (pos) => handleLocationUpdate(pos.coords.latitude, pos.coords.longitude),
    (err) => console.error(err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  );
}

// --- Flow Handlers ---

el.setBtn.addEventListener('click', () => {
  if (!state.targetCoords) {
    alert('Please tap on the map to set a location first.');
    return;
  }
  state.isConfirmed = true;
  el.radiusContainer.classList.add('hidden');
  el.setBtn.classList.add('hidden');
  el.editBtn.classList.remove('hidden');
  el.proxRow.classList.remove('hidden');
  checkProximity();
});

el.editBtn.addEventListener('click', () => {
  state.isConfirmed = false;
  state.isInside = false;
  resetAlarmState(); // Re-arm by resetting the stopped state

  el.radiusContainer.classList.remove('hidden');
  el.setBtn.classList.remove('hidden');
  el.editBtn.classList.add('hidden');
  el.proxRow.classList.add('hidden');
});

el.stopBtn.addEventListener('click', () => {
  state.isAlarmStopped = true;
  el.stopBtn.classList.add('active');
  el.stopBtn.textContent = 'STOPPED';
  el.alarmAudio.pause();
  el.alarmAudio.currentTime = 0;
});

el.findBtn.addEventListener('click', () => {
  if (state.userCoords) {
    map.flyTo([state.userCoords.lat, state.userCoords.lng], 16);
  } else {
    startTracking();
  }
});

el.radiusSlider.addEventListener('input', (e) => {
  state.radius = parseInt(e.target.value);
  el.radiusDisplay.textContent = `${state.radius}m`;
  if (state.targetCircle) state.targetCircle.setRadius(state.radius);
});

el.uploadTrigger.addEventListener('click', () => el.audioInput.click());
el.audioInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) el.alarmAudio.src = URL.createObjectURL(file);
});

map.on('click', (e) => {
  if (state.isConfirmed) return;
  const { lat, lng } = e.latlng;
  state.targetCoords = { lat, lng };
  el.latVal.textContent = lat.toFixed(6);
  el.lngVal.textContent = lng.toFixed(6);

  if (state.targetMarker) {
    state.targetMarker.setLatLng(e.latlng);
    state.targetCircle.setLatLng(e.latlng);
  } else {
    state.targetMarker = L.marker(e.latlng, { icon: destIcon }).addTo(map);
    state.targetCircle = L.circle(e.latlng, {
      radius: state.radius,
      color: '#7c79e5',
      fillColor: '#7c79e5',
      weight: 1.5,
      fillOpacity: 0.1
    }).addTo(map);
  }
});

startTracking();
setTimeout(() => map.invalidateSize(), 500);
