/* Volcán Calbuco — comportamiento de la página.
   CONFIG: pegue aquí los enlaces de ArcGIS Online cuando estén publicados. */
const CONFIG = {
  webmap: "https://geologiaunab.maps.arcgis.com/apps/mapviewer/index.html?webmap=d1a804a4430a4d8592aea0491a4f72c4",   // URL del Web Map o de la aplicación en ArcGIS Online
  survey: "https://survey123.arcgis.com/share/1d7e8dcece554d3a93bb76bd26c43f9f?portalUrl=https://geologiaunab.maps.arcgis.com",   // URL pública del formulario Survey123
  datos: "https://geologiaunab.maps.arcgis.com/home/item.html?id=364d85c45d3241ddbb73c3c18ade1d6c",    // URL del elemento de ArcGIS Online con los shapefiles
  hub: "https://calbuco-geologiaunab.hub.arcgis.com"       // URL del sitio ArcGIS Hub
};

(function () {
  "use strict";

  /* ---------- enlaces configurables ---------- */
  const pending = { webmap: "Mapa interactivo: se publica pronto", survey: "Encuesta: se publica pronto", datos: "Capas: se publican pronto" };
  document.querySelectorAll("[data-link]").forEach((a) => {
    const key = a.dataset.link;
    if (CONFIG[key]) {
      a.href = CONFIG[key];
      a.rel = "noopener"; a.target = "_blank";
    } else {
      a.setAttribute("aria-disabled", "true");
      a.removeAttribute("href");
      a.setAttribute("role", "link");
      a.textContent = pending[key] || a.textContent;
    }
  });
  /* ---------- mapa y encuesta incrustados dentro de la página ---------- */
  function itemId(url) {
    const m = String(url).match(/(?:webmap=|id=|share\/)([0-9a-f]{32})/i) || String(url).match(/^([0-9a-f]{32})$/i);
    return m ? m[1] : null;
  }
  function frame(src, title, h) {
    const f = document.createElement("iframe");
    f.src = src; f.title = title; f.loading = "lazy"; f.allow = "geolocation";
    f.className = "embed"; f.style.height = h; return f;
  }
  const wm = itemId(CONFIG.webmap);
  const fig = document.querySelector("#mapa figure");
  if (wm && fig) {
    fig.textContent = "";
    const host = (String(CONFIG.webmap).match(/^https:\/\/[^/]+/) || ["https://www.arcgis.com"])[0];
    fig.appendChild(frame(host + "/apps/mapviewer/index.html?webmap=" + wm, "Mapa interactivo de peligros del volcán Calbuco", "min(78vh, 760px)"));
    const lg = document.querySelector("#mapa .legend"); if (lg) lg.hidden = true;
  }
  const sv = itemId(CONFIG.survey);
  const svBox = document.querySelector("#encuesta .survey");
  if (sv && svBox) {
    const portal = (String(CONFIG.survey).match(/portalUrl=([^&]+)/) || [])[1];
    svBox.appendChild(frame("https://survey123.arcgis.com/share/" + sv + "?embed=fullscreen,hideheader" + (portal ? "&portalUrl=" + portal : ""), "Encuesta de percepción del riesgo volcánico", "760px"));
  }

  if (!CONFIG.survey) {
    document.querySelectorAll('a.btn[href="#encuesta"]').forEach((a) => a.setAttribute("href", "#encuesta"));
  }

  /* ---------- entradas al hacer scroll ---------- */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".rv, .scale");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add("in"));
  }

  /* ---------- ¿qué llega a mi localidad? ---------- */
  const raw = document.getElementById("datos");
  if (!raw) return;
  let DATA;
  try { DATA = JSON.parse(raw.textContent); } catch (e) { return; }
  const LOC = DATA.loc;
  const GEO = DATA.geo;
  const chips = document.getElementById("chips");
  const result = document.getElementById("result");
  const layers = document.getElementById("mm-layers");
  const dyn = document.getElementById("mm-dyn");
  if (!chips || !result) return;

  const RECORD = {
    "Ensenada": "4.900 personas evacuadas. La caída de lapilli y ceniza alcanzó decenas de centímetros y hundió techos.",
    "Correntoso": "1.500 personas evacuadas.",
    "Río Blanco": "Sector evacuado. Un lahar arrasó instalaciones industriales y viviendas; la crecida derribó dos puentes.",
    "Lago Chapo": "Sector evacuado durante la crisis.",
    "Ralún": "16 personas evacuadas."
  };
  const fmt = (n, d) => n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
  const km = (m) => (m < 1000 ? "menos de 1 km" : "unos " + fmt(Math.round(m / 500) / 2, m >= 10000 ? 0 : 1).replace(",0", "") + " km");

  function tephra(t) {
    let v, txt;
    if (t >= 10) v = Math.round(t / 5) * 5 + " cm";
    else if (t >= 1) v = Math.round(t) + " cm";
    else if (t >= 0.1) v = fmt(t * 10, 0) + " mm";
    else v = null;
    if (t >= 30) txt = "Puede hundir techos de baja pendiente, como ocurrió en Ensenada.";
    else if (t >= 10) txt = "Daña techos débiles y cultivos, y corta caminos.";
    else if (t >= 1) txt = "Corta caminos y servicios y daña cultivos y forraje.";
    else if (t >= 0.1) txt = "Polvo fino en el aire: problemas respiratorios y de visibilidad.";
    else txt = "Prácticamente sin ceniza en este escenario.";
    return { v, txt, w: Math.min(1, t / 80) };
  }

  function rows(o) {
    const r = [];
    // exclusión
    r.push(["Zona de exclusión", o.dist_km <= 10 ? "Dentro del radio de 10 km vigente desde mayo de 2015."
      : o.dist_km <= 20 ? "Dentro del radio de 20 km que se evacuó en abril de 2015."
      : "Fuera de los radios de exclusión de 2015."]);
    // ceniza
    const t = tephra(o.tefra_cm);
    r.push(["Ceniza", (t.v ? "Alrededor de " + t.v + ". " : "") + t.txt +
      '<span class="meter" aria-hidden="true"><i style="transform:scaleX(' + t.w.toFixed(3) + ')"></i></span>' +
      '<span class="small" style="display:block;margin-top:8px;opacity:.85">Escenario con el viento de abril de 2015, hacia el norte-noreste. Con otro viento, la ceniza cae en otra dirección.</span>']);
    // lahares
    let lah;
    if (!o.lahar_dist_m) lah = "Fuera del área modelada, a más de 25 km del cráter.";
    else {
      const d = o.lahar_dist_m, m = Math.min(d.Menor, d.Moderado, d.Mayor);
      const esc = d.Menor === m ? "menor" : d.Moderado === m ? "moderado" : "mayor";
      if (m <= 400) lah = "Junto a un corredor lahárico modelado, desde el escenario " + esc + ". No cruces ríos ni quebradas durante una erupción.";
      else if (m <= 2500) lah = "Corredor lahárico modelado a " + km(m) + " (escenario " + esc + "). Evita los fondos de valle.";
      else lah = "Lejos de los corredores modelados, a " + km(m) + ".";
    }
    r.push(["Lahares", lah]);
    // lava y flujos
    let fl;
    if (o.pdc_dist_m === 0) fl = "Dentro de la envolvente máxima de flujos piroclásticos.";
    else if (o.pdc_dist_m !== null && o.pdc_dist_m < 6000) fl = "A " + km(o.pdc_dist_m) + " del borde de la envolvente de flujos piroclásticos; la lava queda a " + km(o.lava_dist_m) + ".";
    else fl = "Fuera del alcance de la lava y de los flujos piroclásticos.";
    r.push(["Lava y flujos piroclásticos", fl]);
    r.push(["Abril de 2015", RECORD[o.nombre] || "Sin evacuación registrada en las fuentes consultadas."]);
    return r;
  }

  function render(o) {
    const html =
      '<h3>' + o.nombre + '</h3>' +
      '<p class="where">A ' + fmt(o.dist_km, 1) + ' km al ' + o.rumbo + ' del cráter. Comuna de ' + o.comuna + '.</p>' +
      '<dl>' + rows(o).map((x) => '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>').join("") + '</dl>' +
      '<p class="note small muted">Valores modelados para un punto de referencia de cada localidad. No reemplazan la zonificación oficial de SERNAGEOMIN ni las instrucciones de SENAPRED.</p>';
    if (reduce || !result.dataset.ready) { result.innerHTML = html; result.dataset.ready = "1"; }
    else {
      result.classList.add("swap");
      setTimeout(() => { result.innerHTML = html; result.classList.remove("swap"); }, 160);
    }
    // minimapa dinámico
    const NS = "http://www.w3.org/2000/svg";
    dyn.textContent = "";
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", 0); line.setAttribute("y1", 0); line.setAttribute("x2", o.sx); line.setAttribute("y2", o.sy);
    line.setAttribute("class", "mm-line"); dyn.appendChild(line);
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", o.sx); c.setAttribute("cy", o.sy); c.setAttribute("r", 13); c.setAttribute("class", "mm-sel"); dyn.appendChild(c);
    const tx = document.createElementNS(NS, "text");
    const right = o.sx < 150;
    tx.setAttribute("x", o.sx + (right ? 22 : -22)); tx.setAttribute("y", o.sy + 7);
    tx.setAttribute("text-anchor", right ? "start" : "end"); tx.setAttribute("class", "mm-txt");
    tx.textContent = o.nombre; dyn.appendChild(tx);
  }

  function drawBase() {
    const NS = "http://www.w3.org/2000/svg";
    const add = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); layers.appendChild(e); return e; };
    add("path", { d: GEO.pdc, class: "mm-pdc" });
    GEO.isopacas.forEach((i) => add("path", { d: i.d, class: "mm-iso" }));
    add("path", { d: GEO.agua, class: "mm-agua" });
    add("path", { d: GEO.lahar, class: "mm-lahar" });
    add("path", { d: GEO.lava, class: "mm-lava" });
    add("path", { d: GEO.urbano, class: "mm-urb" });
    [100, 200].forEach((r) => add("circle", { cx: 0, cy: 0, r: r, class: "mm-ring" }));
    add("text", { x: 0, y: -206, "text-anchor": "middle", class: "mm-small" }).textContent = "20 km";
    add("text", { x: 0, y: -106, "text-anchor": "middle", class: "mm-small" }).textContent = "10 km";
    LOC.forEach((o) => add("circle", { cx: o.sx, cy: o.sy, r: 5, class: "mm-pt" }));
    add("path", { d: "M0 -14 L13 9 L-13 9 Z", fill: "#15171a", stroke: "#fff", "stroke-width": 3 });
    // escala gráfica: 100 unidades = 10 km
    add("rect", { x: -330, y: 262, width: 180, height: 64, fill: "#ecebe7", opacity: 0.92 });
    add("rect", { x: -315, y: 300, width: 50, height: 10, fill: "#15171a" });
    add("rect", { x: -265, y: 300, width: 50, height: 10, fill: "#ffffff", stroke: "#15171a", "stroke-width": 2 });
    add("text", { x: -315, y: 292, "text-anchor": "middle", class: "mm-small" }).textContent = "0";
    add("text", { x: -265, y: 292, "text-anchor": "middle", class: "mm-small" }).textContent = "5";
    add("text", { x: -215, y: 292, "text-anchor": "middle", class: "mm-small" }).textContent = "10 km";
    // norte
    add("rect", { x: 282, y: -330, width: 48, height: 74, fill: "#ecebe7", opacity: 0.92 });
    add("path", { d: "M306 -322 L320 -290 L306 -298 L292 -290 Z", fill: "#15171a" });
    add("text", { x: 306, y: -264, "text-anchor": "middle", class: "mm-txt" }).textContent = "N";
  }

  drawBase();
  LOC.forEach((o, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = o.nombre;
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    b.addEventListener("click", () => {
      chips.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      render(o);
    });
    chips.appendChild(b);
  });
  render(LOC[0]);
})();
