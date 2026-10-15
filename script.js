document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const destinationSelect = document.getElementById('destination-select');
  const customDistanceGroup = document.getElementById('custom-distance-group');
  const customLyInput = document.getElementById('custom-ly');
  const speedRange = document.getElementById('speed-range');
  const speedVal = document.getElementById('speed-val');
  const propulsionSelect = document.getElementById('propulsion-select');
  const shipMassInput = document.getElementById('ship-mass');
  const accelerationToggle = document.getElementById('acceleration-toggle');
  const calculateBtn = document.getElementById('calculate-btn');

  const resEarthTime = document.getElementById('res-earth-time');
  const resEarthSub = document.getElementById('res-earth-sub');
  const resCrewTime = document.getElementById('res-crew-time');
  const resCrewSub = document.getElementById('res-crew-sub');
  const resLorentz = document.getElementById('res-lorentz');
  const resFuel = document.getElementById('res-fuel');
  const resFuelSub = document.getElementById('res-fuel-sub');
  const insightText = document.getElementById('insight-text');

  const canvas = document.getElementById('trajectory-canvas');
  const ctx = canvas.getContext('2d');

  // Destination database (Distance in light-years)
  const destinations = {
    'proxima': { name: 'Proxima Centauri b', ly: 4.24 },
    'barnard': { name: "Barnard's Star", ly: 5.96 },
    'sirius': { name: 'Sirius A/B', ly: 8.60 },
    'tau-ceti': { name: 'Tau Ceti e', ly: 11.90 },
    'kepler-186f': { name: 'Kepler-186f', ly: 582.0 },
  };

  // Drive Isp values in seconds (effective exhaust velocity ve = Isp * g0)
  // g0 ≈ 9.80665 m/s^2, c ≈ 299,792,458 m/s
  const g0 = 9.80665;
  const c = 299792458;

  function updateSpeedLabel() {
    const val = parseFloat(speedRange.value);
    speedVal.textContent = val.toFixed(val < 10 ? 2 : 1) + '%';
  }

  destinationSelect.addEventListener('change', () => {
    if (destinationSelect.value === 'custom') {
      customDistanceGroup.style.display = 'block';
    } else {
      customDistanceGroup.style.display = 'none';
    }
  });

  speedRange.addEventListener('input', updateSpeedLabel);

  function calculateMission() {
    // Get distance
    let distanceLy;
    let destName;
    if (destinationSelect.value === 'custom') {
      distanceLy = parseFloat(customLyInput.value) || 10.0;
      destName = `${distanceLy} Light-Year Custom Coordinate`;
    } else {
      const key = destinationSelect.value;
      distanceLy = destinations[key].ly;
      destName = destinations[key].name;
    }

    const beta = parseFloat(speedRange.value) / 100.0; // v / c
    if (beta >= 1) beta = 0.99999;
    const gamma = 1.0 / Math.sqrt(1.0 - beta * beta);

    const dryMass = parseFloat(shipMassInput.value) || 500;
    const propulsionType = propulsionSelect.value;
    const useAcceleration = accelerationToggle.checked;

    // Distance in meters
    // 1 light year = c * 365.25 * 24 * 3600 meters
    const metersPerLy = c * 31557600;
    const distanceMeters = distanceLy * metersPerLy;

    let earthTimeYears;
    let crewTimeYears;

    if (!useAcceleration) {
      // Constant cruise speed model
      // Time on Earth = Distance / velocity = (distanceLy * c) / (beta * c) = distanceLy / beta
      earthTimeYears = distanceLy / beta;
      crewTimeYears = earthTimeYears / gamma;
    } else {
      // 1g constant proper acceleration turnaround model (simplified relativistic approximation)
      // Acceleration a = 9.80665 m/s^2
      // Using proper acceleration with turnaround halfway
      // Proper distance x0 = distanceMeters / 2
      // Peak gamma factor reached at midpoint
      const halfDist = distanceMeters / 2;
      const alpha = g0;
      // Exact relativistic motion under constant proper acceleration:
      // c^2/alpha * (cosh(alpha * tau_half / c) - 1) = halfDist
      // Let's compute proper time for half journey:
      const arg = (alpha * halfDist) / (c * c) + 1.0;
      // Using acosh(arg)
      const tauHalf = (c / alpha) * Math.log(arg + Math.sqrt(arg * arg - 1));
      crewTimeYears = (2 * tauHalf) / 31557600;

      // Earth time for half journey:
      // t_half = c / alpha * sinh(alpha * tau_half / c)
      const tHalfSeconds = (c / alpha) * Math.sinh(alpha * tauHalf / c);
      earthTimeYears = (2 * tHalfSeconds) / 31557600;
    }

    // Tsiolkovsky rocket equation for fuel mass ratio
    // m_f / m_0 = exp(-delta_v / v_e)
    // For relativistic missions, effective exhaust velocity v_e is determined by Isp
    let isp;
    if (propulsionType === 'fusion') isp = 1000000;
    else if (propulsionType === 'antimatter') isp = 10000000;
    else if (propulsionType === 'photon') isp = 30000000; // near speed of light exhaust
    else isp = 4500;

    const ve = isp * g0;
    // Approximate relativistic delta-v requirement or classical delta-v
    const maxV = beta * c;
    const deltaV = useAcceleration ? 2 * maxV : maxV; // acceleration + deceleration

    // Mass ratio calculation
    // m_initial = dryMass * exp(deltaV / ve)
    let massRatio = Math.exp(deltaV / ve);
    let initialMass = dryMass * massRatio;
    let propellantMass = initialMass - dryMass;

    if (propulsionType === 'photon') {
      // Photonic laser sail gets push from external lasers, reaction mass is minimal or zero
      propellantMass = dryMass * 0.05; // station keeping / attitude thrusters
    }

    // Render telemetry to DOM
    resEarthTime.textContent = formatTime(earthTimeYears);
    resEarthSub.textContent = `Elapsed in Earth reference frame`;

    resCrewTime.textContent = formatTime(crewTimeYears);
    resCrewSub.textContent = `Aged biologically by crew`;

    resLorentz.textContent = gamma >= 1000 ? gamma.toExponential(3) : gamma.toFixed(2);

    resFuel.textContent = propellantMass > 1e9 ? propellantMass.toExponential(3) + ' t' : Math.round(propellantMass).toLocaleString() + ' t';
    resFuelSub.textContent = propulsionType === 'photon' ? 'External beamed power laser sail' : `Total propellant required`;

    // Update insight commentary
    generateInsight(destName, distanceLy, beta, gamma, earthTimeYears, crewTimeYears, propulsionType);

    // Draw trajectory graph
    drawTrajectory(distanceLy, earthTimeYears, crewTimeYears, beta);
  }

  function formatTime(years) {
    if (years >= 1000000) {
      return (years / 1000000).toFixed(2) + ' Million yrs';
    } else if (years >= 1000) {
      return (years / 1000).toFixed(2) + 'k years';
    } else if (years < 0.01) {
      return (years * 365.25).toFixed(1) + ' days';
    } else if (years < 1) {
      return (years * 12).toFixed(1) + ' months';
    } else {
      return years.toFixed(2) + ' years';
    }
  }

  function generateInsight(destName, distanceLy, beta, gamma, earthTime, crewTime, propulsion) {
    let text = `For your mission to <strong>${destName}</strong> (${distanceLy} light-years away) cruising at ${(beta * 100).toFixed(1)}% the speed of light, relativistic physics exerts a profound compression on onboard crew experience. `;
    
    if (gamma > 1.5) {
      text += `Due to a Lorentz factor of <strong>${gamma.toFixed(2)}</strong>, time dilation ensures the crew ages <strong>${(earthTime / crewTime).toFixed(1)}x slower</strong> than observers back on Earth. While loved ones on Earth age <strong>${formatTime(earthTime)}</strong>, the crew experiences only <strong>${formatTime(crewTime)}</strong> of passage. `;
    } else {
      text += `At this modest velocity, time dilation is minimal (γ = ${gamma.toFixed(2)}), keeping Earth and crew timelines closely synchronized. `;
    }

    if (propulsion === 'chemical') {
      text += `Warning: Chemical/Ion propulsion is severely bottlenecked for interstellar distances; the propellant mass ratio required exceeds physical reactor limits for high-speed relativistic flight. Advanced antimatter or beam-driven photon sails are recommended for speeds > 0.1c.`;
    } else if (propulsion === 'photon') {
      text += `The Photonic Laser Sail utilizes external orbital laser arrays, bypassing the Tsiolkovsky rocket equation limitation by carrying zero onboard reaction mass.`;
    } else {
      text += `Advanced ${propulsion} drive provides high specific impulse capable of sustaining high cruise velocity.`;
    }

    insightText.innerHTML = text;
  }

  function drawTrajectory(distanceLy, earthTime, crewTime, beta) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Draw spacetime curves (Minkowski style diagram representation)
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const maxTime = Math.max(earthTime, crewTime) * 1.1;
    if (maxTime === 0) return;

    // Earth time curve (blue)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    // Crew time curve (pink)
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    const points = 50;
    for (let i = 0; i <= points; i++) {
      const p = i / points;
      const currentEarthT = earthTime * p;
      const currentCrewT = crewTime * p;

      const x = padding + graphWidth * p;
      const yEarth = height - padding - (currentEarthT / maxTime) * graphHeight;
      const yCrew = height - padding - (currentCrewT / maxTime) * graphHeight;

      if (i === 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.moveTo(x, yEarth);
      } else {
        ctx.lineTo(x, yEarth);
      }
    }
    ctx.stroke();

    // Crew line
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const p = i / points;
      const currentCrewT = crewTime * p;
      const x = padding + graphWidth * p;
      const yCrew = height - padding - (currentCrewT / maxTime) * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, yCrew);
      } else {
        ctx.lineTo(x, yCrew);
      }
    }
    ctx.strokeStyle = '#ec4899';
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px system-ui';
    ctx.fillText('Mission Start (0 yrs)', padding, height - 15);
    ctx.fillText('Destination Arrival', width - 140, height - 15);
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Time Elapsed', 0, 0);
    ctx.restore();
  }

  // Initial calculation on load
  updateSpeedLabel();
  calculateMission();

  calculateBtn.addEventListener('click', calculateMission);
});
