;(() => {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]

  // Accessibility helpers
  $("#year").textContent = new Date().getFullYear().toString()

  // Mobile nav
  const navToggle = $(".nav-toggle")
  const navMenu = $("#nav-menu")
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      const expanded = navToggle.getAttribute("aria-expanded") === "true"
      navToggle.setAttribute("aria-expanded", String(!expanded))
      navMenu.classList.toggle("show")
    })
  }

  // Button ripple
  $$(".btn,[data-ripple]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const el = e.currentTarget
      el.classList.remove("rippling")
      void el.offsetWidth // reflow
      el.classList.add("rippling")
      setTimeout(() => el.classList.remove("rippling"), 600)
    })
  })

  // Starfield Canvas
  const starCanvas = $("#starfield")
  if (starCanvas) {
    const ctx = starCanvas.getContext("2d", { alpha: true })
    let stars = []
    const DPR = Math.min(2, window.devicePixelRatio || 1)

    function resize() {
      starCanvas.width = Math.floor(starCanvas.clientWidth * DPR)
      starCanvas.height = Math.floor(starCanvas.clientHeight * DPR)
      initStars()
    }
    function initStars() {
      const count = Math.floor((starCanvas.width * starCanvas.height) / (14000 / DPR))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * starCanvas.width,
        y: Math.random() * starCanvas.height,
        r: Math.random() * (1.2 * DPR) + 0.2,
        tw: Math.random() * Math.PI * 2,
        sp: 0.002 + Math.random() * 0.004,
      }))
    }
    function draw() {
      ctx.clearRect(0, 0, starCanvas.width, starCanvas.height)
      ctx.save()
      for (const s of stars) {
        s.tw += s.sp
        const alpha = 0.65 + Math.sin(s.tw) * 0.35
        ctx.fillStyle = `rgba(255, 241, 200, ${alpha})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      requestAnimationFrame(draw)
    }
    addEventListener("resize", resize)
    resize()
    draw()
  }

  // Contact form validation
  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }
  const contactForm = $("#contact-form")
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const fd = new FormData(contactForm)
      const name = fd.get("name")?.toString().trim()
      const email = fd.get("email")?.toString().trim()
      const message = fd.get("message")?.toString().trim()
      const fb = contactForm.querySelector(".form-feedback")

      if (!name || !email || !message) {
        fb.textContent = "Please fill in all fields."
        fb.style.color = "#f87171"
        return
      }
      if (!validateEmail(email)) {
        fb.textContent = "Please enter a valid email."
        fb.style.color = "#f87171"
        return
      }
      fb.textContent = "Thanks! We'll get back to you soon."
      fb.style.color = "var(--ok)"
      contactForm.reset()
    })
  }

  const newsletterForm = $("#newsletter-form")
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault()
      const email = new FormData(newsletterForm).get("email")?.toString().trim()
      const fb = newsletterForm.querySelector(".form-feedback")
      if (!email || !validateEmail(email)) {
        fb.textContent = "Please enter a valid email."
        fb.style.color = "#f87171"
        return
      }
      fb.textContent = "You're subscribed. Clear skies ahead."
      fb.style.color = "var(--ok)"
      newsletterForm.reset()
    })
  }

  // Simulation
  const simForm = $("#sim-form")
  const simCanvas = /** @type {HTMLCanvasElement} */ ($("#sim-canvas"))
  const ctxSim = simCanvas?.getContext("2d")
  const DPR = Math.min(2, window.devicePixelRatio || 1)
  if (simCanvas) {
    // HiDPI
    function resizeSim() {
      const w = simCanvas.clientWidth
      const h = simCanvas.clientHeight
      simCanvas.width = Math.floor(w * DPR)
      simCanvas.height = Math.floor(h * DPR)
    }
    resizeSim()
    addEventListener("resize", resizeSim)
  }

  let lastResult = null

  function toRad(d) {
    return (d * Math.PI) / 180
  }
  function toDeg(r) {
    return (r * 180) / Math.PI
  }

  // Client-side fallback calculation (approximate)
  function calcLocal(lat, lon, dateStr, timeStr, gnomon = 1) {
    const d = dateStr ? new Date(dateStr + "T" + (timeStr || "12:00") + ":00") : new Date()
    const n = Math.floor(
      (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000,
    )
    // Declination approximate
    const decl = -23.44 * Math.cos(toRad((360 / 365) * (n + 10)))
    // Equation of time approximation (minutes)
    const B = toRad((360 / 365) * (n - 81))
    const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
    const localTime = d.getHours() + d.getMinutes() / 60
    const LSTM = 15 * Math.round(lon / 15) // crude
    const TC = (4 * (lon - LSTM) + EoT) / 60 // hours
    const LST = localTime + TC
    const H = 15 * (LST - 12) // hour angle in degrees
    const phi = lat

    const sinAlt =
      Math.sin(toRad(phi)) * Math.sin(toRad(decl)) + Math.cos(toRad(phi)) * Math.cos(toRad(decl)) * Math.cos(toRad(H))
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) // radians
    const cosAz =
      (Math.sin(toRad(decl)) - Math.sin(toRad(phi)) * Math.sin(alt)) / (Math.cos(toRad(phi)) * Math.cos(alt))
    const az = Math.acos(Math.max(-1, Math.min(1, cosAz))) // radians from South?
    // Adjust azimuth (measure from North, clockwise)
    // Use sign of sin(H) to determine east/west
    const sinH = Math.sin(toRad(H))
    let A = sinH > 0 ? Math.PI + (Math.PI - az) : az // from North CW
    A = (A + 2 * Math.PI) % (2 * Math.PI)

    const altitudeDeg = toDeg(alt)
    const azimuthDeg = toDeg(A)
    const shadowLength = altitudeDeg > 0.1 ? gnomon / Math.tan(alt) : Number.POSITIVE_INFINITY

    // Day path
    // Sunrise/sunset hour angle
    const cosH0 = -Math.tan(toRad(phi)) * Math.tan(toRad(decl))
    const H0 = Math.acos(Math.max(-1, Math.min(1, cosH0))) // radians
    const lenH = Math.floor(((2 * toDeg(H0)) / 15) * 4) // 15min steps
    const times = []
    const pts = []
    for (let i = 0; i <= lenH; i++) {
      const hour = 12 - toDeg(H0) / 15 + i * 0.25 // hours
      const Hdeg = 15 * (hour - 12)
      const sinAlt_i =
        Math.sin(toRad(phi)) * Math.sin(toRad(decl)) +
        Math.cos(toRad(phi)) * Math.cos(toRad(decl)) * Math.cos(toRad(Hdeg))
      const alt_i = Math.asin(Math.max(-1, Math.min(1, sinAlt_i)))
      const cosAz_i =
        (Math.sin(toRad(decl)) - Math.sin(toRad(phi)) * Math.sin(alt_i)) / (Math.cos(toRad(phi)) * Math.cos(alt_i))
      const az_i = Math.acos(Math.max(-1, Math.min(1, cosAz_i)))
      const sinH_i = Math.sin(toRad(Hdeg))
      let A_i = sinH_i > 0 ? Math.PI + (Math.PI - az_i) : az_i
      A_i = (A_i + 2 * Math.PI) % (2 * Math.PI)
      const altDeg = toDeg(alt_i)
      const shadowL = altDeg > 0.1 ? gnomon / Math.tan(alt_i) : Number.POSITIVE_INFINITY
      times.push(hour)
      pts.push({ alt: altDeg, az: toDeg(A_i), shadow: shadowL })
    }

    return {
      input: { lat, lon, date: dateStr, time: timeStr, gnomon },
      declination: decl,
      altitude: altitudeDeg,
      azimuth: azimuthDeg,
      shadowLength,
      path: pts,
      hours: times,
    }
  }

  async function apiCalculate(lat, lon, dateStr, timeStr, gnomon) {
    try {
      const res = await fetch("/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon, date: dateStr, time: timeStr, gnomonHeight: gnomon }),
      })
      if (!res.ok) throw new Error("API error")
      return await res.json()
    } catch {
      // fallback local
      return calcLocal(lat, lon, dateStr, timeStr, gnomon)
    }
  }

  function drawSimulation(result, options = { color: "#FFD166", compare: [] }) {
    const ctx = ctxSim
    const W = simCanvas.width,
      H = simCanvas.height
    ctx.clearRect(0, 0, W, H)

    // Base ground and dial
    ctx.save()
    ctx.fillStyle = "rgba(255,255,255,0.04)"
    ctx.strokeStyle = "rgba(255,255,255,0.12)"
    ctx.lineWidth = 2
    const cx = W * 0.5,
      cy = H * 0.68
    const R = Math.min(W, H) * 0.32
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.stroke()
    // N/E/S/W ticks
    const ticks = [0, 90, 180, 270]
    for (const t of ticks) {
      const ang = ((-t + 90) * Math.PI) / 180
      const x1 = cx + Math.cos(ang) * (R - 8)
      const y1 = cy - Math.sin(ang) * (R - 8)
      const x2 = cx + Math.cos(ang) * (R + 8)
      const y2 = cy - Math.sin(ang) * (R + 8)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
    // Labels
    ctx.fillStyle = "rgba(255,255,255,0.7)"
    ctx.font = `${14 * DPR}px var(--font-sans)`
    ctx.textAlign = "center"
    ctx.fillText("N", cx, cy - R - 10 * DPR)
    ctx.fillText("S", cx, cy + R + 18 * DPR)
    ctx.fillText("E", cx + R + 14 * DPR, cy + 4 * DPR)
    ctx.fillText("W", cx - R - 14 * DPR, cy + 4 * DPR)

    // Shadow path for day (gold)
    function drawPath(path, color = "#FFD166") {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      let first = true
      for (const p of path) {
        if (!isFinite(p.shadow) || p.alt <= 0) continue
        const len = Math.min(p.shadow, R * 1.5)
        // Shadow goes away from the sun; sun azimuth measured from N clockwise
        const theta = ((p.az + 180) * Math.PI) / 180 // opposite direction for shadow tip
        const x = cx + Math.sin(theta) * len * 12 * DPR // scale for view
        const y = cy + Math.cos(theta) * len * 12 * DPR
        if (first) {
          ctx.moveTo(x, y)
          first = false
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // Compare traces first (if any)
    const compare = options.compare || []
    const palette = ["#8ecae6", "#ffadad", "#bdb2ff", "#90be6d", "#ffd166", "#ffb703", "#fb8500"]
    compare.forEach((cmp, i) => {
      if (cmp?.path) drawPath(cmp.path, palette[i % palette.length])
    })

    // Current moment
    if (result?.path) drawPath(result.path, options.color)

    // Current shadow vector
    if (isFinite(result?.shadowLength) && result.altitude > 0) {
      const len = Math.min(result.shadowLength, R * 1.5)
      const theta = ((result.azimuth + 180) * Math.PI) / 180
      const x = cx + Math.sin(theta) * len * 12 * DPR
      const y = cy + Math.cos(theta) * len * 12 * DPR
      ctx.strokeStyle = "#FFB703"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.fillStyle = "#FFB703"
      ctx.beginPath()
      ctx.arc(x, y, 4 * DPR, 0, Math.PI * 2)
      ctx.fill()
    }

    // Info
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = `${13 * DPR}px var(--font-sans)`
    ctx.textAlign = "left"
    const info = [
      `Alt: ${result.altitude?.toFixed(2)}°`,
      `Az: ${result.azimuth?.toFixed(2)}°`,
      `Shadow: ${isFinite(result.shadowLength) ? result.shadowLength.toFixed(3) + " m" : "—"}`,
      `Decl: ${result.declination?.toFixed(2)}°`,
    ]
    info.forEach((t, i) => ctx.fillText(t, 16 * DPR, 28 * DPR + i * 18 * DPR))

    ctx.restore()
  }

  async function runSimulation(evt) {
    evt?.preventDefault()
    const lat = Number.parseFloat($("#lat").value)
    const lon = Number.parseFloat($("#lon").value)
    const date = $("#date").value || new Date().toISOString().slice(0, 10)
    const time = $("#time").value || "12:00"
    const gnomon = Number.parseFloat($("#gnomon").value) || 1

    const result = await apiCalculate(lat, lon, date, time, gnomon)
    lastResult = result
    drawSimulation(result)
  }

  if (simForm) {
    simForm.addEventListener("submit", runSimulation)
    // Autofill default date
    $("#date").value = new Date().toISOString().slice(0, 10)
    // initial draw
    runSimulation()
  }

  // Global comparison mode
  $("#compare")?.addEventListener("click", async () => {
    const date = $("#date").value || new Date().toISOString().slice(0, 10)
    const time = $("#time").value || "12:00"
    const gnomon = Number.parseFloat($("#gnomon").value) || 1
    const presets = [
      { name: "Ujjain, India", lat: 23.18, lon: 75.78 },
      { name: "Giza, Egypt", lat: 30.01, lon: 31.21 },
      { name: "Athens, Greece", lat: 37.98, lon: 23.72 },
    ]
    const compare = []
    for (const p of presets) {
      const r = await apiCalculate(p.lat, p.lon, date, time, gnomon)
      compare.push({ ...r, name: p.name })
    }
    const base = await apiCalculate(
      Number.parseFloat($("#lat").value),
      Number.parseFloat($("#lon").value),
      date,
      time,
      gnomon,
    )
    lastResult = base
    drawSimulation(base, { compare })
  })

  // Exports
  $("#export-img")?.addEventListener("click", () => {
    const link = document.createElement("a")
    link.download = `astrogen-simulation-${Date.now()}.png`
    link.href = simCanvas.toDataURL("image/png")
    link.click()
  })

  $("#export-json")?.addEventListener("click", () => {
    const data = lastResult || {}
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `astrogen-simulation-${Date.now()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  })

  $("#export-pdf")?.addEventListener("click", async () => {
    const imgData = simCanvas.toDataURL("image/png")
    try {
      const res = await fetch("/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "AstroGen Simulation",
          notes: "Shadow path export",
          imageDataURL: imgData,
        }),
      })
      if (!res.ok) throw new Error("PDF export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `astrogen-simulation-${Date.now()}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    } catch (e) {
      // fallback: prompt image download
      alert("Server PDF export unavailable. Downloading image instead.")
      const link = document.createElement("a")
      link.download = `astrogen-simulation-${Date.now()}.png`
      link.href = imgData
      link.click()
    }
  })

  // Gesture navigation (swipe between sections)
  let touchStartX = 0,
    touchStartY = 0
  const sections = $$(".section, .hero")
  function currentSectionIndex() {
    const scrollY = window.scrollY + window.innerHeight * 0.35
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect()
      const top = r.top + window.scrollY
      const bottom = top + r.height
      if (scrollY >= top && scrollY <= bottom) return i
    }
    return 0
  }
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0]
      touchStartX = t.clientX
      touchStartY = t.clientY
    },
    { passive: true },
  )
  document.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStartX
      const dy = t.clientY - touchStartY
      if (Math.abs(dx) > 50 && Math.abs(dy) < 60) {
        const idx = currentSectionIndex()
        const next = dx < 0 ? Math.min(idx + 1, sections.length - 1) : Math.max(idx - 1, 0)
        sections[next].scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
    { passive: true },
  )
})()
