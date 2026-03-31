// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: magic;
// Replace with your own keys (also configure them in the Depart app Setup screen).
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

const HOME_LAT = 37.7511;
const HOME_LNG = -122.4149;
const CPS_LAT = 37.8124;
const CPS_LNG = -122.2328;
const WALK_TO_BUS_MINS = 4;
const BUS_TO_BART_WALK_MINS = 2;
const ROCKRIDGE_DEADLINE_H = 8;
const ROCKRIDGE_DEADLINE_M = 5;
const CPS_DEADLINE_H = 8;
const CPS_DEADLINE_M = 10;
const BART_API_KEY = "YOUR_BART_API_KEY";
const BART_ORIGIN = "24TH";
const BART_DEST = "ROCK";
const MUNI_STOP_ID = "15741";
const MUNI_AGENCY = "SF";
const API_511_KEY = "YOUR_511_API_KEY";

async function fetchBARTEtd() {
  const url = "https://api.bart.gov/api/etd.aspx?cmd=etd&orig=" + BART_ORIGIN + "&json=y&key=" + BART_API_KEY;
  const req = new Request(url);
  try {
    const data = await req.loadJSON();
    const etds = data.root.station[0].etd || [];
    let trains = [];
    for (const line of etds) {
      for (const est of line.estimate) {
        const dest = line.destination;
        if (dest === "Richmond" || dest === "Antioch" || dest === "Pittsburg/Bay Point") {
          const mins = est.minutes === "Leaving" ? 0 : parseInt(est.minutes);
          if (!isNaN(mins)) {
            trains.push({ dest: dest, minsFromNow: mins, departsAt: new Date(Date.now() + mins * 60000) });
          }
        }
      }
    }
    trains.sort((a, b) => a.minsFromNow - b.minsFromNow);
    return trains;
  } catch (e) { return null; }
}

async function fetchBARTTripTime() {
  const now = new Date();
  const hour = now.getHours();
  const min = now.getMinutes().toString().padStart(2, "0");
  const url = "https://api.bart.gov/api/sched.aspx?cmd=depart&orig=" + BART_ORIGIN + "&dest=" + BART_DEST + "&time=" + hour + ":" + min + "+am&date=today&json=y&key=" + BART_API_KEY + "&b=0&a=3";
  const req = new Request(url);
  try {
    const data = await req.loadJSON();
    const trips = data.root.schedule.request.trip;
    if (!trips) return 30;
    const tripArr = Array.isArray(trips) ? trips : [trips];
    const leg = tripArr[0].leg;
    if (!leg) return 30;
    const legArr = Array.isArray(leg) ? leg : [leg];
    let totalMins = 0;
    for (const l of legArr) {
      const orig = new Date(l["@origTimeDate"] + " " + l["@origTimeMin"]);
      const dest = new Date(l["@destTimeDate"] + " " + l["@destTimeMin"]);
      totalMins += Math.round((dest - orig) / 60000);
    }
    return totalMins > 0 ? totalMins : 30;
  } catch (e) { return 30; }
}

async function fetchMuniBuses() {
  const url = "https://api.511.org/transit/StopMonitoring?api_key=" + API_511_KEY + "&agency=" + MUNI_AGENCY + "&stopCode=" + MUNI_STOP_ID + "&format=json";
  const req = new Request(url);
  try {
    const text = await req.loadString();
    const clean = text.replace(/^\uFEFF/, "");
    const data = JSON.parse(clean);
    const visits = data.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit || [];
    let buses = [];
    for (const v of visits) {
      const journey = v.MonitoredVehicleJourney;
      if (!journey) continue;
      const lineRef = (journey.LineRef || "").replace("SF:", "");
      if (["12", "14", "49", "14R", "49R"].includes(lineRef)) {
        const call = journey.MonitoredCall;
        const timeStr = call.ExpectedDepartureTime || call.AimedDepartureTime || call.ExpectedArrivalTime || call.AimedArrivalTime;
        if (timeStr) {
          const dt = new Date(timeStr);
          const minsFromNow = Math.round((dt - Date.now()) / 60000);
          if (minsFromNow >= -1) {
            buses.push({ line: lineRef, departsAt: dt, minsFromNow: minsFromNow });
          }
        }
      }
    }
    buses.sort((a, b) => a.departsAt - b.departsAt);
    return buses.slice(0, 5);
  } catch (e) { return null; }
}

async function fetchDriveTime() {
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const body = {
    origin: { location: { latLng: { latitude: HOME_LAT, longitude: HOME_LNG } } },
    destination: { location: { latLng: { latitude: CPS_LAT, longitude: CPS_LNG } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    departureTime: new Date().toISOString()
  };
  const req = new Request(url);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": "routes.duration"
  };
  req.body = JSON.stringify(body);
  try {
    const data = await req.loadJSON();
    const durationStr = data.routes[0].duration;
    if (durationStr) {
      const secs = parseInt(durationStr.replace("s", ""));
      return Math.ceil(secs / 60);
    }
    return null;
  } catch (e) { return null; }
}

function fmtTime(date) {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ":" + m + " " + ampm;
}

function deadlineDate(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

async function run() {
  const now = new Date();
  const [buses, trains, bartTripMins, driveTimeMins] = await Promise.all([
    fetchMuniBuses(), fetchBARTEtd(), fetchBARTTripTime(), fetchDriveTime()
  ]);

  const rockridgeDeadline = deadlineDate(ROCKRIDGE_DEADLINE_H, ROCKRIDGE_DEADLINE_M);
  const cpsDeadline = deadlineDate(CPS_DEADLINE_H, CPS_DEADLINE_M);
  const latestBARTBoardTime = new Date(rockridgeDeadline.getTime() - bartTripMins * 60000);
  const latestBusArrivalAt24th = new Date(latestBARTBoardTime.getTime() - BUS_TO_BART_WALK_MINS * 60000);
  const BUS_RIDE_MINS = 5;

  let validBuses = [];
  if (buses) {
    for (const bus of buses) {
      const arriveAt24th = new Date(bus.departsAt.getTime() + BUS_RIDE_MINS * 60000);
      const leaveHome = new Date(bus.departsAt.getTime() - WALK_TO_BUS_MINS * 60000);
      const canStillCatch = leaveHome > now;
      const bartDeparture = new Date(arriveAt24th.getTime() + BUS_TO_BART_WALK_MINS * 60000);
      let matchedTrain = null;
      if (trains) {
        for (const t of trains) {
          if (t.departsAt >= bartDeparture) { matchedTrain = t; break; }
        }
      }
      const actualArrivalRockridge = matchedTrain
        ? new Date(matchedTrain.departsAt.getTime() + bartTripMins * 60000)
        : new Date(bartDeparture.getTime() + bartTripMins * 60000);
      if (canStillCatch) {
        validBuses.push({ bus, leaveHome, arriveAt24th, bartDeparture, matchedTrain, actualArrivalRockridge, onTime: actualArrivalRockridge <= rockridgeDeadline });
      }
    }
  }

  let driveLeaveBy = null;
  let driveStatus = null;
  if (driveTimeMins !== null) {
    driveLeaveBy = new Date(cpsDeadline.getTime() - driveTimeMins * 60000);
    const minsUntilLeave = Math.round((driveLeaveBy - now) / 60000);
    driveStatus = minsUntilLeave < 0 ? "LATE" : minsUntilLeave < 5 ? "URGENT" : "OK";
  }

  const widget = new ListWidget();
  widget.backgroundColor = new Color("#FFFFFF");
  widget.setPadding(14, 16, 14, 16);

  const header = widget.addText("Morning Commute");
  header.font = Font.boldSystemFont(14);
  header.textColor = new Color("#111111");

  const timeText = widget.addText(fmtTime(now));
  timeText.font = Font.systemFont(11);
  timeText.textColor = new Color("#888888");

  widget.addSpacer(10);

  const transitHeader = widget.addText("TRANSIT - Rockridge by 8:05 AM");
  transitHeader.font = Font.boldSystemFont(12);
  transitHeader.textColor = new Color("#185FA5");
  widget.addSpacer(4);

  if (!buses && !trains) {
    const err = widget.addText("Could not load transit data");
    err.font = Font.systemFont(11);
    err.textColor = new Color("#A32D2D");
  } else if (validBuses.length === 0) {
    const err = widget.addText("No buses reach Rockridge by 8:05 AM");
    err.font = Font.systemFont(11);
    err.textColor = new Color("#A32D2D");
    if (trains && trains.length > 0) {
      for (const t of trains.slice(0, 3)) {
        const arr = new Date(t.departsAt.getTime() + bartTripMins * 60000);
        const ok = arr <= rockridgeDeadline;
        const row = widget.addText((ok ? "OK " : "LATE ") + fmtTime(t.departsAt) + " BART - Rockridge " + fmtTime(arr));
        row.font = Font.systemFont(11);
        row.textColor = new Color(ok ? "#3B6D11" : "#A32D2D");
      }
    }
  } else {
    for (const opt of validBuses.slice(0, 2)) {
      const leaveMinsDelta = Math.round((opt.leaveHome - now) / 60000);
      const status = leaveMinsDelta <= 0 ? "NOW" : leaveMinsDelta <= 5 ? "SOON" : "OK";
      const leaveStr = leaveMinsDelta <= 0 ? "Leave NOW" : "Leave by " + fmtTime(opt.leaveHome) + " (" + leaveMinsDelta + "m)";
      const row1 = widget.addText(status + " " + leaveStr);
      row1.font = Font.boldSystemFont(12);
      row1.textColor = new Color(leaveMinsDelta <= 0 ? "#A32D2D" : leaveMinsDelta <= 5 ? "#854F0B" : "#3B6D11");
      const bartStr = opt.matchedTrain
        ? "Bus " + opt.bus.line + " @" + fmtTime(opt.bus.departsAt) + " - BART @" + fmtTime(opt.matchedTrain.departsAt) + " - Rockridge " + fmtTime(opt.actualArrivalRockridge)
        : "Bus " + opt.bus.line + " @" + fmtTime(opt.bus.departsAt) + " - BART ~" + fmtTime(opt.bartDeparture);
      const row2 = widget.addText("  " + bartStr);
      row2.font = Font.systemFont(10);
      row2.textColor = new Color("#555555");
      widget.addSpacer(4);
    }
  }

  widget.addSpacer(8);

  const driveHeader = widget.addText("DRIVE - CPS by 8:10 AM");
  driveHeader.font = Font.boldSystemFont(12);
  driveHeader.textColor = new Color("#3B6D11");
  widget.addSpacer(4);

  if (driveTimeMins === null) {
    const err = widget.addText("Could not load traffic data");
    err.font = Font.systemFont(11);
    err.textColor = new Color("#A32D2D");
  } else {
    const minsUntilLeave = Math.round((driveLeaveBy - now) / 60000);
    const driveLeaveStr = driveStatus === "LATE" ? "Should have left already" : "Leave by " + fmtTime(driveLeaveBy) + " (" + minsUntilLeave + "m)";
    const driveRow1 = widget.addText(driveStatus + " " + driveLeaveStr);
    driveRow1.font = Font.boldSystemFont(12);
    driveRow1.textColor = new Color(driveStatus === "LATE" ? "#A32D2D" : driveStatus === "URGENT" ? "#854F0B" : "#3B6D11");
    const driveRow2 = widget.addText("  " + driveTimeMins + " min with current traffic");
    driveRow2.font = Font.systemFont(10);
    driveRow2.textColor = new Color("#555555");
  }

  widget.addSpacer(6);
  const mapsUrl = "https://maps.google.com/?saddr=" + HOME_LAT + "," + HOME_LNG + "&daddr=" + CPS_LAT + "," + CPS_LNG + "&directionsmode=driving";
  widget.url = mapsUrl;
  const tapNote = widget.addText("Tap to open Google Maps");
  tapNote.font = Font.systemFont(9);
  tapNote.textColor = new Color("#AAAAAA");

  if (config.runsInWidget) {
    Script.setWidget(widget);
  } else {
    await widget.presentMedium();
  }
  Script.complete();
}

await run();