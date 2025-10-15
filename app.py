from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import Dict, Any, List

from flask import Flask, request, jsonify, send_from_directory, send_file, make_response
import os
import io
import base64

try:
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import letter
    REPORTLAB_OK = True
except Exception:
    REPORTLAB_OK = False

app = Flask(__name__, static_folder='.', static_url_path='')

def to_rad(d: float) -> float: return d * math.pi / 180.0
def to_deg(r: float) -> float: return r * 180.0 / math.pi

def solar_calc(latitude: float, longitude: float, date_str: str, time_str: str, gnomon: float = 1.0) -> Dict[str, Any]:
    # parse date/time
    try:
        if date_str:
            dt = datetime.fromisoformat(f"{date_str}T{time_str or '12:00'}:00")
        else:
            dt = datetime.now()
    except Exception:
        dt = datetime.now()

    year = dt.year
    n = (datetime(year, dt.month, dt.day, tzinfo=timezone.utc) - datetime(year, 1, 1, tzinfo=timezone.utc)).days + 1

    # Declination (approx)
    decl = -23.44 * math.cos(to_rad((360/365.0)*(n+10)))

    # Equation of Time (minutes)
    B = to_rad((360.0/365.0)*(n-81))
    EoT = 9.87*math.sin(2*B) - 7.53*math.cos(B) - 1.5*math.sin(B)

    local_time_hours = dt.hour + dt.minute/60.0
    LSTM = 15.0 * round(longitude/15.0)
    TC = (4.0*(longitude - LSTM) + EoT) / 60.0  # hours
    LST = local_time_hours + TC
    H = 15.0 * (LST - 12.0)  # hour angle (deg)

    phi = latitude
    sin_alt = math.sin(to_rad(phi))*math.sin(to_rad(decl)) + math.cos(to_rad(phi))*math.cos(to_rad(decl))*math.cos(to_rad(H))
    sin_alt = max(-1.0, min(1.0, sin_alt))
    alt = math.asin(sin_alt)
    cos_az = (math.sin(to_rad(decl)) - math.sin(to_rad(phi))*math.sin(alt)) / (math.cos(to_rad(phi))*math.cos(alt))
    cos_az = max(-1.0, min(1.0, cos_az))
    az = math.acos(cos_az)
    # Adjust azimuth from North clockwise
    sinH = math.sin(to_rad(H))
    if sinH > 0:  # afternoon
        A = math.pi + (math.pi - az)
    else:
        A = az
    A = (A + 2*math.pi) % (2*math.pi)

    altitude_deg = to_deg(alt)
    azimuth_deg = to_deg(A)
    shadow_length = (gnomon / math.tan(alt)) if altitude_deg > 0.1 else float("inf")

    # Day path
    cosH0 = -math.tan(to_rad(phi)) * math.tan(to_rad(decl))
    cosH0 = max(-1.0, min(1.0, cosH0))
    H0 = math.acos(cosH0)  # radians
    step_min = 15  # 15-minute steps
    span_hours = (2*to_deg(H0))/15.0
    steps = int(span_hours*60/step_min)
    path: List[Dict[str, float]] = []
    hours: List[float] = []
    for i in range(steps+1):
        hour = 12.0 - to_deg(H0)/15.0 + i*(step_min/60.0)
        Hdeg = 15.0 * (hour - 12.0)
        sin_alt_i = math.sin(to_rad(phi))*math.sin(to_rad(decl)) + math.cos(to_rad(phi))*math.cos(to_rad(decl))*math.cos(to_rad(Hdeg))
        sin_alt_i = max(-1.0, min(1.0, sin_alt_i))
        alt_i = math.asin(sin_alt_i)
        cos_az_i = (math.sin(to_rad(decl)) - math.sin(to_rad(phi))*math.sin(alt_i)) / (math.cos(to_rad(phi))*math.cos(alt_i))
        cos_az_i = max(-1.0, min(1.0, cos_az_i))
        az_i = math.acos(cos_az_i)
        sinH_i = math.sin(to_rad(Hdeg))
        if sinH_i > 0:
            A_i = math.pi + (math.pi - az_i)
        else:
            A_i = az_i
        A_i = (A_i + 2*math.pi) % (2*math.pi)
        altDeg = to_deg(alt_i)
        shL = (gnomon / math.tan(alt_i)) if altDeg > 0.1 else float("inf")
        path.append({"alt": altDeg, "az": to_deg(A_i), "shadow": shL})
        hours.append(hour)

    return {
        "input": {"lat": latitude, "lon": longitude, "date": date_str, "time": time_str, "gnomon": gnomon},
        "declination": decl,
        "altitude": altitude_deg,
        "azimuth": azimuth_deg,
        "shadowLength": shadow_length,
        "path": path,
        "hours": hours
    }

@app.route("/")
def index():
    return send_file("index.html")

@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json(force=True, silent=True) or {}
    lat = float(data.get("latitude", 0.0))
    lon = float(data.get("longitude", 0.0))
    date = data.get("date")
    time = data.get("time", "12:00")
    gnomon = float(data.get("gnomonHeight", 1.0))
    result = solar_calc(lat, lon, date, time, gnomon)
    return jsonify(result)

@app.route("/visualize", methods=["GET"])
def visualize():
    # Example: return precomputed sample dataset for front-end testing
    try:
      return send_file("data.json", mimetype="application/json")
    except Exception:
      return jsonify({"error":"sample data not found"}), 404

@app.route("/export-pdf", methods=["POST"])
def export_pdf():
    data = request.get_json(force=True, silent=True) or {}
    title = data.get("title", "AstroGen Simulation")
    notes = data.get("notes", "")
    image_data_url = data.get("imageDataURL")

    if not image_data_url or not image_data_url.startswith("data:image/png;base64,"):
        return jsonify({"error":"Invalid image data"}), 400

    if not REPORTLAB_OK:
        return jsonify({"error":"ReportLab not available on server"}), 503

    try:
        img_b64 = image_data_url.split(",",1)[1]
        img_bytes = base64.b64decode(img_b64)
        buf = io.BytesIO()
        c = rl_canvas.Canvas(buf, pagesize=letter)
        width, height = letter

        # Title
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, height-72, title)
        c.setFont("Helvetica", 10)
        c.drawString(72, height-92, f"Generated by AstroGen • {datetime.now().isoformat(timespec='seconds')}")

        # Notes
        c.setFont("Helvetica", 11)
        c.drawString(72, height-120, notes[:90])

        # Draw image
        img_buf = io.BytesIO(img_bytes)
        img_w = width - 144
        img_h = img_w * 0.55
        c.drawImage(img_buf, 72, height - 120 - img_h - 12, width=img_w, height=img_h, preserveAspectRatio=True, mask='auto')

        c.showPage()
        c.save()
        pdf_bytes = buf.getvalue()
        out = make_response(pdf_bytes)
        out.headers["Content-Type"] = "application/pdf"
        out.headers["Content-Disposition"] = f'attachment; filename="astrogen-simulation.pdf"'
        return out
    except Exception as e:
        return jsonify({"error": f"Failed to create PDF: {e}"}), 500

# Static files fallback (css/js/json)
@app.route("/<path:path>")
def static_proxy(path):
    if os.path.isfile(path):
        return send_from_directory(".", path)
    return "Not Found", 404

if __name__ == "__main__":
    # For local dev: python app.py
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
