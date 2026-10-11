"use strict";
/* Mis Cuentas — libro de cuentas personal. Todo se guarda en localStorage de este navegador. */

const KEY = "misCuentas.v1";
const CATS = {
  gasto: ["Comida", "Transporte", "Universidad", "Vivienda", "Servicios", "Salud", "Gimnasio", "Ocio", "Ropa", "Ahorro/Inversión", "Otros"],
  ingreso: ["Trabajo", "Familia", "Beca/Monitoría", "Ventas", "Rendimientos", "Otros"]
};
const MEDIOS_DEFAULT = ["Nequi", "Bancolombia", "Daviplata", "Efectivo"];

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const fmt = n => (n < 0 ? "−" : "") + "$ " + Math.abs(Math.round(n)).toLocaleString("es-CO");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- almacenamiento ---------- */
let state = { movimientos: [], medios: MEDIOS_DEFAULT.slice() };
let storageOk = true;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.movimientos)) state.movimientos = data.movimientos.filter(validMov);
      if (Array.isArray(data.medios) && data.medios.length) state.medios = data.medios.map(String);
    }
  } catch (_) {
    storageOk = false;
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    storageOk = false;
    showNotice(err && err.name === "QuotaExceededError"
      ? "Se llenó el espacio del navegador. Exporta un respaldo y borra movimientos viejos."
      : "Este navegador no permite guardar datos (¿modo incógnito?). Lo que registres se perderá al cerrar.");
    return false;
  }
}
function validMov(m) {
  return m && (m.tipo === "gasto" || m.tipo === "ingreso") && Number(m.monto) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha || "");
}
function showNotice(t) { $("notice").hidden = false; $("notice").textContent = t; }

/* ---------- formulario ---------- */
let tipo = "gasto";
let view = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();

function setTipo(t) {
  tipo = t;
  $("tGasto").setAttribute("aria-pressed", t === "gasto");
  $("tIngreso").setAttribute("aria-pressed", t === "ingreso");
  $("categoria").innerHTML = CATS[t].map(c => `<option>${esc(c)}</option>`).join("");
  $("save").textContent = t === "gasto" ? "Guardar gasto" : "Guardar ingreso";
}
function fillMedios() {
  const sel = $("cuenta"), prev = sel.value;
  sel.innerHTML = state.medios.map(m => `<option>${esc(m)}</option>`).join("");
  if (state.medios.includes(prev)) sel.value = prev;
}
function showMsg(el, t, err) { el.textContent = t; el.className = "msg" + (err ? " err" : ""); }

$("tGasto").onclick = () => setTipo("gasto");
$("tIngreso").onclick = () => setTipo("ingreso");
$("monto").addEventListener("input", e => {
  const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
  e.target.value = digits ? Number(digits).toLocaleString("es-CO") : "";
});
$("prev").onclick = () => { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); };
$("next").onclick = () => { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); };

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const monto = Number($("monto").value.replace(/\D/g, ""));
  if (!monto) { showMsg($("msg"), "Escribe un monto mayor a cero.", true); $("monto").focus(); return; }
  const fecha = $("fecha").value || todayISO();
  state.movimientos.push({
    id: uid(), tipo, monto, categoria: $("categoria").value, cuenta: $("cuenta").value,
    fecha, nota: $("nota").value.trim(), creado: Date.now()
  });
  save();
  $("monto").value = ""; $("nota").value = "";
  showMsg($("msg"), (tipo === "gasto" ? "Gasto" : "Ingreso") + " guardado: " + fmt(monto) + ".");
  const [y, m] = fecha.split("-").map(Number);
  view = { y, m: m - 1 };
  render();
});

/* ---------- eliminar (confirmación en dos toques) ---------- */
$("ledger").addEventListener("click", e => {
  const b = e.target.closest(".del"); if (!b) return;
  if (!b.classList.contains("confirm")) {
    document.querySelectorAll(".del.confirm").forEach(x => { x.classList.remove("confirm"); x.textContent = "✕"; });
    b.classList.add("confirm"); b.textContent = "¿Eliminar?";
    return;
  }
  state.movimientos = state.movimientos.filter(m => m.id !== b.dataset.id);
  save(); render();
});

/* ---------- medios de pago ---------- */
function renderMedios() {
  $("medios").innerHTML = state.medios.map((m, i) => `
    <li><label class="sr" for="medio${i}">Nombre del medio ${i + 1}</label>
      <input id="medio${i}" data-i="${i}" value="${esc(m)}" maxlength="30">
      <button type="button" class="del" data-i="${i}" aria-label="Quitar ${esc(m)}">✕</button></li>`).join("");
  fillMedios();
}
$("medios").addEventListener("change", e => {
  const inp = e.target.closest("input"); if (!inp) return;
  const i = +inp.dataset.i, nuevo = inp.value.trim(), viejo = state.medios[i];
  if (!nuevo || (nuevo !== viejo && state.medios.includes(nuevo))) { inp.value = viejo; return; }
  state.medios[i] = nuevo;
  state.movimientos.forEach(m => { if (m.cuenta === viejo) m.cuenta = nuevo; });
  save(); renderMedios(); render();
});
$("medios").addEventListener("click", e => {
  const b = e.target.closest(".del"); if (!b) return;
  if (state.medios.length <= 1) return;
  if (!b.classList.contains("confirm")) {
    document.querySelectorAll("#medios .del.confirm").forEach(x => { x.classList.remove("confirm"); x.textContent = "✕"; });
    b.classList.add("confirm"); b.textContent = "¿Quitar?";
    return;
  }
  state.medios.splice(+b.dataset.i, 1);
  save(); renderMedios();
});
$("medioForm").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("nuevoMedio").value.trim();
  if (!v || state.medios.includes(v)) return;
  state.medios.push(v); $("nuevoMedio").value = "";
  save(); renderMedios();
});

/* ---------- respaldo ---------- */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("expJson").onclick = () => {
  download(`mis-cuentas-${todayISO()}.json`, JSON.stringify({ app: "mis-cuentas", version: 1, ...state }, null, 2), "application/json");
  showMsg($("bkMsg"), `Respaldo descargado (${state.movimientos.length} movimientos).`);
};
$("expCsv").onclick = () => {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["fecha", "tipo", "monto", "categoria", "medio", "detalle"]]
    .concat(state.movimientos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(m => [m.fecha, m.tipo, m.monto, m.categoria, m.cuenta, m.nota]));
  download(`mis-cuentas-${todayISO()}.csv`, "﻿" + rows.map(r => r.map(q).join(",")).join("\r\n"), "text/csv");
  showMsg($("bkMsg"), "CSV descargado. Se abre en Excel o Google Sheets.");
};
$("impBtn").onclick = () => $("impFile").click();
$("impFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const movs = Array.isArray(data.movimientos) ? data.movimientos.filter(validMov) : null;
    if (!movs) throw new Error("formato");
    const ids = new Set(state.movimientos.map(m => m.id));
    let nuevos = 0;
    movs.forEach(m => {
      const mov = { id: m.id || uid(), tipo: m.tipo, monto: Number(m.monto), categoria: String(m.categoria || "Otros"),
        cuenta: String(m.cuenta || ""), fecha: m.fecha, nota: String(m.nota || "").slice(0, 80), creado: Number(m.creado) || Date.now() };
      if (!ids.has(mov.id)) { state.movimientos.push(mov); ids.add(mov.id); nuevos++; }
      if (mov.cuenta && !state.medios.includes(mov.cuenta)) state.medios.push(mov.cuenta);
    });
    save(); renderMedios(); render();
    showMsg($("bkMsg"), `Importados ${nuevos} movimientos nuevos (${movs.length - nuevos} ya estaban).`);
  } catch (_) {
    showMsg($("bkMsg"), "Ese archivo no es un respaldo válido de Mis Cuentas.", true);
  }
});

/* ---------- render ---------- */
function render() {
  const key = `${view.y}-${pad(view.m + 1)}`;
  $("monthLabel").textContent = cap(new Date(view.y, view.m, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" }));
  const all = state.movimientos;
  const mes = all.filter(r => r.fecha.startsWith(key));
  const sum = (arr, t) => arr.filter(r => r.tipo === t).reduce((a, r) => a + (+r.monto || 0), 0);
  const inc = sum(mes, "ingreso"), out = sum(mes, "gasto"), bal = inc - out;
  const acum = sum(all, "ingreso") - sum(all, "gasto");
  $("sIn").textContent = fmt(inc);
  $("sOut").textContent = fmt(out);
  $("sBal").textContent = fmt(bal);
  $("sBal").className = "v num " + (bal < 0 ? "neg" : "pos");
  $("sAcum").textContent = "Acumulado total: " + fmt(acum);

  const byCat = {};
  mes.filter(r => r.tipo === "gasto").forEach(r => byCat[r.categoria] = (byCat[r.categoria] || 0) + (+r.monto || 0));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;
  $("cats").innerHTML = cats.length ? cats.map(([c, v]) => `
    <div class="cat"><span>${esc(c)}</span><span class="bar"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span>
    <span class="num">${fmt(v)} <span class="sub">${Math.round(v / out * 100)}%</span></span></div>`).join("")
    : `<div class="sub">Sin gastos este mes.</div>`;

  if (!mes.length) {
    $("ledger").innerHTML = `<div class="empty">No hay movimientos en este mes. Registra un gasto o ingreso arriba y aparecerá aquí, agrupado por día.</div>`;
    return;
  }
  const days = {};
  mes.forEach(r => (days[r.fecha] ||= []).push(r));
  $("ledger").innerHTML = Object.keys(days).sort().reverse().map(d => {
    const list = days[d].sort((a, b) => (b.creado || 0) - (a.creado || 0));
    const net = list.reduce((a, r) => a + (r.tipo === "ingreso" ? 1 : -1) * (+r.monto || 0), 0);
    const label = cap(new Date(d + "T12:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" }));
    return `<div class="day"><span>${esc(label)}</span><span class="num">${fmt(net)}</span></div>` +
      list.map(r => `<div class="row">
        <div class="t"><b>${esc(r.nota || r.categoria)}</b><small>${esc(r.categoria)}${r.cuenta ? " · " + esc(r.cuenta) : ""}</small></div>
        <span class="num ${r.tipo === "ingreso" ? "pos" : "neg"}">${r.tipo === "ingreso" ? "+" : "−"}${fmt(+r.monto)}</span>
        <button class="del" data-id="${esc(r.id)}" aria-label="Eliminar movimiento">✕</button>
      </div>`).join("");
  }).join("");
}

/* ---------- inicio ---------- */
load();
if (!storageOk) showNotice("Este navegador no permite guardar datos (¿modo incógnito?). Lo que registres se perderá al cerrar.");
$("fecha").value = todayISO();
setTipo("gasto");
renderMedios();
render();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
