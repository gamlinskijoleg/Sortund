/* Sortund admin panel — plain JS client of the REST API (served by the backend at /admin). */
(function () {
    "use strict";

    const API = window.location.origin;
    const PAGE_SIZE = 25;
    const STATUS_UA = {
        queued: "У черзі",
        processing: "Обробляється",
        done: "Готово",
        failed: "Помилка",
        pending: "Нове",
        approved: "Відібрано",
        rejected: "Відхилено",
    };

    // ── Helpers ─────────────────────────────────────────────────────────────

    const $ = (sel) => document.querySelector(sel);
    const esc = (value) =>
        String(value ?? "").replace(
            /[&<>"']/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
        );
    const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("uk-UA") : "—");
    const fmtPct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
    const fmtMs = (ms) =>
        ms == null ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} с` : `${ms} мс`;

    function toast(message) {
        const el = $("#toast");
        el.textContent = message;
        el.hidden = false;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => (el.hidden = true), 4000);
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    // ── Auth & API ──────────────────────────────────────────────────────────

    const tokens = {
        get access() {
            return sessionStorage.getItem("sortund.access");
        },
        get refresh() {
            return sessionStorage.getItem("sortund.refresh");
        },
        set(pair) {
            sessionStorage.setItem("sortund.access", pair.accessToken);
            sessionStorage.setItem("sortund.refresh", pair.refreshToken);
        },
        clear() {
            sessionStorage.removeItem("sortund.access");
            sessionStorage.removeItem("sortund.refresh");
        },
    };

    let refreshing = null;
    async function refreshTokens() {
        if (!tokens.refresh) return false;
        if (!refreshing) {
            refreshing = fetch(`${API}/auth/refresh`, {
                method: "POST",
                headers: { Authorization: `Bearer ${tokens.refresh}` },
            })
                .then(async (res) => {
                    if (!res.ok) return false;
                    tokens.set(await res.json());
                    return true;
                })
                .catch(() => false)
                .finally(() => setTimeout(() => (refreshing = null), 0));
        }
        return refreshing;
    }

    async function api(path, options = {}, retried = false) {
        const headers = { ...(options.headers || {}) };
        if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
        if (options.body && typeof options.body !== "string") {
            headers["Content-Type"] = "application/json";
            options = { ...options, body: JSON.stringify(options.body) };
        }
        const res = await fetch(`${API}${path}`, { ...options, headers });
        if (res.status === 401 && !retried && (await refreshTokens())) {
            return api(path, options, true);
        }
        if (res.status === 401) {
            showLogin();
            throw new Error("Сесія завершилась, увійдіть знову");
        }
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) {
            const message = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
            throw new Error(message || `Помилка ${res.status}`);
        }
        return data;
    }

    function showLogin() {
        tokens.clear();
        $("#app-view").hidden = true;
        $("#login-view").hidden = false;
    }

    async function showApp() {
        const me = await api("/users/me");
        if (me.role !== "admin") {
            showLogin();
            $("#login-error").textContent = "Цей обліковий запис не має ролі адміністратора.";
            return;
        }
        $("#whoami").textContent = me.email;
        $("#login-view").hidden = true;
        $("#app-view").hidden = false;
        switchTab(location.hash.slice(1) || "overview");
    }

    $("#login-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = new FormData(event.target);
        $("#login-error").textContent = "";
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                $("#login-error").textContent =
                    res.status === 403
                        ? "Обліковий запис заблоковано."
                        : res.status === 429
                          ? `Забагато спроб. Спробуйте через ${Math.ceil((data.retryAfterSeconds || 60) / 60)} хв.`
                          : "Невірна пошта або пароль.";
                return;
            }
            tokens.set(data);
            await showApp();
        } catch (error) {
            $("#login-error").textContent = String(error.message || error);
        }
    });

    $("#logout").addEventListener("click", async () => {
        try {
            await api("/auth/logout", { method: "POST" });
        } catch {
            /* ignore */
        }
        showLogin();
    });

    // ── Tabs ────────────────────────────────────────────────────────────────

    const loaders = {};
    function switchTab(name) {
        if (!loaders[name]) name = "overview";
        location.hash = name;
        document
            .querySelectorAll("#tabs button")
            .forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
        document
            .querySelectorAll("main > section")
            .forEach((s) => (s.hidden = s.dataset.view !== name));
        loaders[name]().catch((e) => toast(e.message));
    }
    document
        .querySelectorAll("#tabs button")
        .forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

    function renderPager(el, page, total, onPage) {
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        el.innerHTML = `<span class="muted">Усього: ${total}</span>
            <button ${page <= 1 ? "disabled" : ""} data-p="${page - 1}">‹</button>
            <span>${page} / ${pages}</span>
            <button ${page >= pages ? "disabled" : ""} data-p="${page + 1}">›</button>`;
        el.querySelectorAll("button").forEach((b) =>
            b.addEventListener("click", () => onPage(Number(b.dataset.p)))
        );
    }

    // ── Overview ────────────────────────────────────────────────────────────

    function kpi(label, value) {
        return `<div class="kpi"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`;
    }

    function renderDaysChart(days) {
        const w = 640;
        const h = 220;
        const pad = { l: 30, r: 8, t: 10, b: 26 };
        const max = Math.max(1, ...days.map((d) => d.analyses));
        const bw = (w - pad.l - pad.r) / days.length;
        const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
        let bars = "";
        days.forEach((d, i) => {
            const x = pad.l + i * bw + bw * 0.15;
            const width = bw * 0.7;
            const fresh = d.analyses - d.fromCache;
            bars += `<rect class="bar-a" x="${x}" y="${y(fresh)}" width="${width}" height="${h - pad.b - y(fresh)}"><title>${esc(d.day)}: ${fresh} моделями</title></rect>`;
            bars += `<rect class="bar-b" x="${x}" y="${y(d.analyses)}" width="${width}" height="${y(fresh) - y(d.analyses)}"><title>${esc(d.day)}: ${d.fromCache} з кешу</title></rect>`;
            if (
                days.length <= 31 &&
                (i % Math.ceil(days.length / 10) === 0 || i === days.length - 1)
            ) {
                bars += `<text x="${x + width / 2}" y="${h - 8}" text-anchor="middle">${esc(d.day.slice(5))}</text>`;
            }
        });
        const axis = `<text x="4" y="${pad.t + 8}">${max}</text><text x="4" y="${h - pad.b}">0</text>`;
        $("#chart-days").innerHTML =
            `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${axis}${bars}</svg>`;
    }

    function renderGenres(topGenres) {
        if (!topGenres.length) {
            $("#chart-genres").innerHTML = `<p class="muted">Ще немає проаналізованих треків.</p>`;
            return;
        }
        const max = Math.max(...topGenres.map((g) => g.count));
        $("#chart-genres").innerHTML = topGenres
            .map(
                (g) => `<div class="hbar"><span>${esc(g.genre)}</span>
                <div class="track"><div class="fill" style="width:${(g.count / max) * 100}%"></div></div>
                <span class="n">${g.count}</span></div>`
            )
            .join("");
    }

    function renderQueue(queue) {
        $("#queue-counts").innerHTML =
            kpi("У черзі", queue.queued) +
            kpi("Обробляються", queue.processing) +
            kpi("Готово", queue.done) +
            kpi("З помилкою", queue.failed);
    }

    loaders.overview = async () => {
        const days = $("#stats-days").value;
        const s = await api(`/admin/stats?days=${days}`);
        const today = s.days[s.days.length - 1] || { analyses: 0, newUsers: 0 };
        $("#kpis").innerHTML =
            kpi("Користувачів", s.usersTotal) +
            kpi("Аналізів сьогодні", today.analyses) +
            kpi(`Аналізів за ${days} дн.`, s.analysesTotal) +
            kpi("Частка з кешу", fmtPct(s.cacheHitRatio)) +
            kpi("Середній час аналізу", fmtMs(s.avgAnalysisMs)) +
            kpi("Середній час (кеш)", fmtMs(s.avgCacheMs));
        renderDaysChart(s.days);
        renderGenres(s.topGenres);
        renderQueue(s.queue);
    };
    $("#stats-days").addEventListener("change", () =>
        loaders.overview().catch((e) => toast(e.message))
    );
    $("#stats-refresh").addEventListener("click", () =>
        loaders.overview().catch((e) => toast(e.message))
    );

    // ── Users ───────────────────────────────────────────────────────────────

    let usersPage = 1;
    loaders.users = async () => {
        const search = $("#user-search").value.trim();
        const data = await api(
            `/admin/users?page=${usersPage}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(search)}`
        );
        $("#users-body").innerHTML = data.items
            .map(
                (u) => `<tr data-id="${esc(u.id)}">
                <td>${esc(u.email)}</td>
                <td><select data-f="role">
                    <option value="user" ${u.role === "user" ? "selected" : ""}>користувач</option>
                    <option value="admin" ${u.role === "admin" ? "selected" : ""}>адміністратор</option>
                </select></td>
                <td><input data-f="limit" type="number" min="0" max="100000" value="${u.monthlyAnalysisLimit}" /></td>
                <td class="num">${u.usedThisMonth}</td>
                <td>${u.isBlocked ? '<span class="badge bad">заблоковано</span>' : '<span class="badge ok">активний</span>'}</td>
                <td>${fmtDate(u.createdAt)}</td>
                <td><button data-a="save">Зберегти</button>
                    <button data-a="block" class="${u.isBlocked ? "" : "danger"}">${u.isBlocked ? "Розблокувати" : "Заблокувати"}</button></td>
            </tr>`
            )
            .join("");
        $("#users-body")
            .querySelectorAll("tr")
            .forEach((row) => {
                const id = row.dataset.id;
                const user = data.items.find((u) => u.id === id);
                row.querySelector('[data-a="save"]').addEventListener("click", async () => {
                    try {
                        await api(`/admin/users/${id}`, {
                            method: "PATCH",
                            body: {
                                role: row.querySelector('[data-f="role"]').value,
                                monthlyAnalysisLimit: Number(
                                    row.querySelector('[data-f="limit"]').value
                                ),
                            },
                        });
                        toast("Збережено");
                        await loaders.users();
                    } catch (e) {
                        toast(e.message);
                    }
                });
                row.querySelector('[data-a="block"]').addEventListener("click", async () => {
                    try {
                        await api(`/admin/users/${id}`, {
                            method: "PATCH",
                            body: { isBlocked: !user.isBlocked },
                        });
                        toast(user.isBlocked ? "Розблоковано" : "Заблоковано, сесії завершено");
                        await loaders.users();
                    } catch (e) {
                        toast(e.message);
                    }
                });
            });
        renderPager($("#users-pager"), usersPage, data.total, (p) => {
            usersPage = p;
            loaders.users().catch((e) => toast(e.message));
        });
    };
    $("#user-search").addEventListener(
        "input",
        debounce(() => {
            usersPage = 1;
            loaders.users().catch((e) => toast(e.message));
        }, 300)
    );

    // ── Queue ───────────────────────────────────────────────────────────────

    let jobsPage = 1;
    loaders.queue = async () => {
        const status = $("#job-status").value;
        const data = await api(
            `/admin/jobs?page=${jobsPage}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}`
        );
        $("#jobs-body").innerHTML =
            data.items
                .map(
                    (j) => `<tr data-id="${esc(j.id)}">
                <td>${esc(j.filename)}</td>
                <td>${esc(j.email)}</td>
                <td><span class="badge ${j.status === "failed" ? "bad" : j.status === "done" ? "ok" : "warn"}">${esc(STATUS_UA[j.status] || j.status)}</span>${j.fromCache ? ' <span class="badge accent">кеш</span>' : ""}</td>
                <td class="num">${j.attempts}</td>
                <td class="num">${fmtMs(j.durationMs)}</td>
                <td>${fmtDate(j.createdAt)}</td>
                <td class="err-text">${esc(j.error || "")}</td>
                <td>${j.status === "failed" ? '<button data-a="retry">Повторити</button>' : ""}</td>
            </tr>`
                )
                .join("") || `<tr><td colspan="8" class="muted">Немає задач</td></tr>`;
        $("#jobs-body")
            .querySelectorAll('[data-a="retry"]')
            .forEach((b) =>
                b.addEventListener("click", async () => {
                    const id = b.closest("tr").dataset.id;
                    try {
                        await api(`/admin/jobs/${id}/retry`, { method: "POST" });
                        toast("Задачу повернуто в чергу");
                        await loaders.queue();
                    } catch (e) {
                        toast(e.message);
                    }
                })
            );
        renderPager($("#jobs-pager"), jobsPage, data.total, (p) => {
            jobsPage = p;
            loaders.queue().catch((e) => toast(e.message));
        });
    };
    $("#job-status").addEventListener("change", () => {
        jobsPage = 1;
        loaders.queue().catch((e) => toast(e.message));
    });
    $("#retry-all").addEventListener("click", async () => {
        try {
            const r = await api("/admin/jobs/retry-failed", { method: "POST" });
            toast(`Повернуто в чергу: ${r.requeued}`);
            await loaders.queue();
        } catch (e) {
            toast(e.message);
        }
    });

    // ── Corrections ─────────────────────────────────────────────────────────

    let corrPage = 1;
    loaders.corrections = async () => {
        const status = $("#corr-status").value;
        const field = $("#corr-field").value;
        const qs = `page=${corrPage}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}${field ? `&field=${field}` : ""}`;
        const data = await api(`/admin/corrections?${qs}`);
        $("#corr-labels").textContent = data.labels.join(", ") || "—";
        $("#corr-body").innerHTML =
            data.items
                .map(
                    (c) => `<tr data-id="${esc(c.id)}">
                <td>${esc(c.track || c.fingerprint)}</td>
                <td>${c.field === "genre" ? "жанр" : "настрій"}</td>
                <td>${esc(c.oldValue || "—")}</td>
                <td><b>${esc(c.newValue)}</b></td>
                <td>${esc(c.email)}</td>
                <td>${fmtDate(c.createdAt)}</td>
                <td>${c.usableForTraining ? '<span class="badge ok">так</span>' : '<span class="badge">ні</span>'}</td>
                <td>${esc(STATUS_UA[c.status])}${c.usedInVersion ? ` <span class="badge accent">${esc(c.usedInVersion)}</span>` : ""}</td>
                <td>${c.status !== "approved" ? '<button data-s="approved">Відібрати</button>' : ""}
                    ${c.status !== "rejected" ? '<button data-s="rejected" class="danger">Відхилити</button>' : ""}</td>
            </tr>`
                )
                .join("") || `<tr><td colspan="9" class="muted">Немає виправлень</td></tr>`;
        $("#corr-body")
            .querySelectorAll("button[data-s]")
            .forEach((b) =>
                b.addEventListener("click", async () => {
                    const id = b.closest("tr").dataset.id;
                    try {
                        await api(`/admin/corrections/${id}`, {
                            method: "PATCH",
                            body: { status: b.dataset.s },
                        });
                        await loaders.corrections();
                    } catch (e) {
                        toast(e.message);
                    }
                })
            );
        renderPager($("#corr-pager"), corrPage, data.total, (p) => {
            corrPage = p;
            loaders.corrections().catch((e) => toast(e.message));
        });
    };
    ["#corr-status", "#corr-field"].forEach((sel) =>
        $(sel).addEventListener("change", () => {
            corrPage = 1;
            loaders.corrections().catch((e) => toast(e.message));
        })
    );

    // ── Models ──────────────────────────────────────────────────────────────

    function delta(v) {
        if (v == null) return "";
        const cls = v >= 0 ? "delta-up" : "delta-down";
        return ` <span class="${cls}">(${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)} п.п.)</span>`;
    }

    function confusionTable(metrics) {
        const labels = metrics.labels;
        const max = Math.max(1, ...metrics.confusion_matrix.flat());
        const head = labels.map((l) => `<th>${esc(l)}</th>`).join("");
        const rows = metrics.confusion_matrix
            .map(
                (row, i) =>
                    `<tr><th class="row">${esc(labels[i])}</th>${row
                        .map((v, j) => {
                            const alpha = v / max;
                            const color =
                                i === j
                                    ? `rgba(31,138,76,${alpha})`
                                    : `rgba(192,57,43,${alpha * 0.8})`;
                            return `<td style="background:${v ? color : "transparent"}">${v}</td>`;
                        })
                        .join("")}</tr>`
            )
            .join("");
        return `<table class="confusion"><tr><th>істина \\ прогноз</th>${head}</tr>${rows}</table>`;
    }

    function f1Bars(metrics) {
        return Object.entries(metrics.f1_per_genre)
            .map(
                ([genre, f1]) => `<div class="hbar"><span>${esc(genre)}</span>
                <div class="track"><div class="fill" style="width:${f1 * 100}%"></div></div>
                <span class="n">${f1.toFixed(2)}</span></div>`
            )
            .join("");
    }

    loaders.models = async () => {
        const versions = await api("/admin/models");
        if (!versions.length) {
            $("#models-list").innerHTML =
                `<div class="card muted">Версій ще немає — бекенд імпортує їх з AI-воркера під час запуску.</div>`;
            return;
        }
        $("#models-list").innerHTML = versions
            .map((v) => {
                const m = v.metrics;
                const c = v.comparison;
                return `<div class="card model" data-id="${esc(v.id)}">
                <div class="model-head">
                    <h3 style="margin:0">${esc(v.version)}</h3>
                    ${v.isActive ? '<span class="badge ok">активна</span>' : ""}
                    <span class="muted">створено ${fmtDate(v.createdAt)} · виправлень у навчанні: ${v.correctionsUsed}</span>
                    <span class="spacer"></span>
                    ${
                        v.isActive
                            ? ""
                            : `<button data-a="activate" ${c && !c.canActivate ? 'disabled title="Метрики гірші за активну версію"' : ""} class="${c && c.canActivate ? "primary" : ""}">Активувати</button>`
                    }
                </div>
                ${
                    m
                        ? `<div class="metric-row">
                        <span>Точність (accuracy): <b>${fmtPct(m.accuracy)}</b>${c ? delta(c.accuracyDelta) : ""}</span>
                        <span>Macro-F1: <b>${m.macro_f1.toFixed(3)}</b>${c ? delta(c.macroF1Delta) : ""}</span>
                        <span class="muted">тестових прикладів: ${m.test_samples ?? "—"}, навчальних: ${m.train_samples ?? "—"}</span>
                    </div>
                    <details><summary>F1 за жанрами та матриця помилок</summary>
                        <div class="grid2" style="margin-top:12px"><div>${f1Bars(m)}</div><div style="overflow-x:auto">${confusionTable(m)}</div></div>
                    </details>`
                        : '<p class="muted">Метрик немає</p>'
                }
            </div>`;
            })
            .join("");
        $("#models-list")
            .querySelectorAll('[data-a="activate"]')
            .forEach((b) =>
                b.addEventListener("click", async () => {
                    const id = b.closest(".model").dataset.id;
                    try {
                        const r = await api(`/admin/models/${id}/activate`, { method: "POST" });
                        toast(`Активовано ${r.version}`);
                        await loaders.models();
                    } catch (e) {
                        toast(e.message);
                    }
                })
            );
    };

    $("#train").addEventListener("click", async () => {
        const button = $("#train");
        button.disabled = true;
        $("#train-status").textContent = "Навчання триває…";
        try {
            const r = await api("/admin/models/train", { method: "POST" });
            $("#train-status").textContent =
                `Створено ${r.version}: точність ${fmtPct(r.metrics.accuracy)}, macro-F1 ${r.metrics.macro_f1.toFixed(3)}, ` +
                `виправлень використано: ${r.correctionsUsed}. ` +
                (r.comparison.canActivate
                    ? "Метрики не гірші — версію можна активувати."
                    : "Метрики гірші за активну — активація недоступна.");
            await loaders.models();
        } catch (e) {
            $("#train-status").textContent = "";
            toast(e.message);
        } finally {
            button.disabled = false;
        }
    });

    // ── Start ───────────────────────────────────────────────────────────────

    if (tokens.access) {
        showApp().catch(() => showLogin());
    } else {
        showLogin();
    }
})();
