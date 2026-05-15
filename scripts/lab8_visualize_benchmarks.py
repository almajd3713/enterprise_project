from __future__ import annotations

import json
import math
import re
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"

POSTGRES_FILE = DOCS / "lab8_k6_postgres_summary.txt"
CASSANDRA_FILE = DOCS / "lab8_k6_cassandra_summary.txt"

OUT_CSV = DOCS / "lab8_benchmark_comparison.csv"
OUT_MD = DOCS / "lab8_benchmark_statistics.md"
OUT_JSON = DOCS / "lab8_benchmark_statistics.json"
OUT_PNG_MAIN = DOCS / "lab8_benchmark_comparison.png"
OUT_PNG_LAT = DOCS / "lab8_latency_profile.png"
OUT_HTML = DOCS / "lab8_benchmark_dashboard.html"


def extract_float(pattern: str, text: str, default: float = float("nan")) -> float:
    m = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    if not m:
        return default
    return float(m.group(1))


def find_line_with_prefix(text: str, prefix: str) -> str:
    for raw in text.splitlines():
        if raw.strip().startswith(prefix):
            return raw.strip()
    return ""


def find_failed_metric_line(text: str) -> str:
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("http_req_failed") and "out of" in line and ":" in line:
            return line
    return ""


def parse_total_and_rate(line: str) -> tuple[float, float]:
    if not line:
        return float("nan"), float("nan")

    total_match = re.search(r":\s*([0-9]+)", line)
    rate_match = re.search(r"([0-9]*\.?[0-9]+)/s", line)
    total = float(total_match.group(1)) if total_match else float("nan")
    rate = float(rate_match.group(1)) if rate_match else float("nan")
    return total, rate


def parse_failed_line(line: str) -> tuple[float, float]:
    if not line:
        return float("nan"), float("nan")

    pct_match = re.search(r":\s*([0-9]*\.?[0-9]+)%", line)
    outof_match = re.search(r"\s+([0-9]+) out of", line)
    pct = float(pct_match.group(1)) if pct_match else float("nan")
    count = float(outof_match.group(1)) if outof_match else float("nan")
    return pct, count


def extract_number_with_unit(value: str) -> float:
    value = value.strip()
    m = re.match(r"([0-9]*\.?[0-9]+)\s*([a-zA-Z\u00b5]+)?", value)
    if not m:
        return float("nan")
    num = float(m.group(1))
    unit = (m.group(2) or "").lower()

    # Convert time-like values to milliseconds.
    if unit in {"ms", "msec"}:
        return num
    if unit in {"s", "sec"}:
        return num * 1000
    if unit in {"us", "\u00b5s"}:
        return num / 1000
    if unit in {"ns"}:
        return num / 1_000_000
    return num


def extract_time_metric(line_prefix: str, text: str) -> dict[str, float]:
    line = ""
    for raw in text.splitlines():
        if raw.strip().startswith(line_prefix):
            line = raw
            break
    if not line:
        return {
            "avg_ms": float("nan"),
            "min_ms": float("nan"),
            "med_ms": float("nan"),
            "max_ms": float("nan"),
            "p90_ms": float("nan"),
            "p95_ms": float("nan"),
        }

    def pick(name: str) -> float:
        m = re.search(rf"{name}=([^\s]+)", line)
        if not m:
            return float("nan")
        return extract_number_with_unit(m.group(1))

    return {
        "avg_ms": pick("avg"),
        "min_ms": pick("min"),
        "med_ms": pick("med"),
        "max_ms": pick("max"),
        "p90_ms": pick("p\(90\)"),
        "p95_ms": pick("p\(95\)"),
    }


def parse_k6_summary(path: Path, backend: str) -> dict[str, float | str]:
    text = path.read_text(encoding="utf-8", errors="ignore")

    http_line = find_line_with_prefix(text, "http_reqs")
    iter_line = find_line_with_prefix(text, "iterations")
    checks_line = find_line_with_prefix(text, "checks_total")
    failed_line = find_failed_metric_line(text)

    reqs_total, reqs_rate = parse_total_and_rate(http_line)
    _, iter_rate = parse_total_and_rate(iter_line)
    checks_total, _ = parse_total_and_rate(checks_line)
    err_rate, err_count = parse_failed_line(failed_line)

    dur = extract_time_metric("http_req_duration", text)
    iter_dur = extract_time_metric("iteration_duration", text)

    return {
        "backend": backend,
        "http_reqs_total": reqs_total,
        "http_reqs_rate": reqs_rate,
        "iterations_rate": iter_rate,
        "checks_total": checks_total,
        "http_req_failed_pct": err_rate,
        "http_req_failed_count": err_count,
        "http_req_duration_avg_ms": dur["avg_ms"],
        "http_req_duration_min_ms": dur["min_ms"],
        "http_req_duration_med_ms": dur["med_ms"],
        "http_req_duration_max_ms": dur["max_ms"],
        "http_req_duration_p90_ms": dur["p90_ms"],
        "http_req_duration_p95_ms": dur["p95_ms"],
        "iteration_duration_avg_ms": iter_dur["avg_ms"],
        "iteration_duration_p95_ms": iter_dur["p95_ms"],
    }


def percent_delta(new: float, old: float) -> float:
    if old == 0 or math.isnan(old) or math.isnan(new):
        return float("nan")
    return (new - old) / old * 100


def build_markdown(df: pd.DataFrame) -> str:
    pg = df[df["backend"] == "PostgreSQL"].iloc[0]
    cs = df[df["backend"] == "Cassandra"].iloc[0]

    throughput_speedup = cs["http_reqs_rate"] / pg["http_reqs_rate"]
    p95_improvement = -percent_delta(cs["http_req_duration_p95_ms"], pg["http_req_duration_p95_ms"])
    avg_improvement = -percent_delta(cs["http_req_duration_avg_ms"], pg["http_req_duration_avg_ms"])

    rows = []
    rows.append("# Lab 8 Benchmark Statistics")
    rows.append("")
    rows.append("## Core Comparison")
    rows.append("")
    rows.append("| Metric | PostgreSQL | Cassandra | Delta |")
    rows.append("|---|---:|---:|---:|")
    rows.append(
        f"| Throughput (req/s) | {pg['http_reqs_rate']:.2f} | {cs['http_reqs_rate']:.2f} | {percent_delta(cs['http_reqs_rate'], pg['http_reqs_rate']):+.2f}% |"
    )
    rows.append(
        f"| Total requests | {int(pg['http_reqs_total'])} | {int(cs['http_reqs_total'])} | {percent_delta(cs['http_reqs_total'], pg['http_reqs_total']):+.2f}% |"
    )
    rows.append(
        f"| Avg latency (ms) | {pg['http_req_duration_avg_ms']:.2f} | {cs['http_req_duration_avg_ms']:.2f} | {percent_delta(cs['http_req_duration_avg_ms'], pg['http_req_duration_avg_ms']):+.2f}% |"
    )
    rows.append(
        f"| p90 latency (ms) | {pg['http_req_duration_p90_ms']:.2f} | {cs['http_req_duration_p90_ms']:.2f} | {percent_delta(cs['http_req_duration_p90_ms'], pg['http_req_duration_p90_ms']):+.2f}% |"
    )
    rows.append(
        f"| p95 latency (ms) | {pg['http_req_duration_p95_ms']:.2f} | {cs['http_req_duration_p95_ms']:.2f} | {percent_delta(cs['http_req_duration_p95_ms'], pg['http_req_duration_p95_ms']):+.2f}% |"
    )
    rows.append(
        f"| Max latency (ms) | {pg['http_req_duration_max_ms']:.2f} | {cs['http_req_duration_max_ms']:.2f} | {percent_delta(cs['http_req_duration_max_ms'], pg['http_req_duration_max_ms']):+.2f}% |"
    )
    rows.append(
        f"| Error rate (%) | {pg['http_req_failed_pct']:.2f} | {cs['http_req_failed_pct']:.2f} | {percent_delta(cs['http_req_failed_pct'], pg['http_req_failed_pct']) if pg['http_req_failed_pct'] != 0 else 0:+.2f}% |"
    )
    rows.append(
        f"| Failed requests | {int(pg['http_req_failed_count'])} | {int(cs['http_req_failed_count'])} | {percent_delta(cs['http_req_failed_count'], pg['http_req_failed_count']) if pg['http_req_failed_count'] != 0 else 0:+.2f}% |"
    )
    rows.append("")
    rows.append("## Executive Stats")
    rows.append("")
    rows.append(f"- Cassandra throughput speedup: {throughput_speedup:.2f}x")
    rows.append(f"- Cassandra p95 latency reduction: {p95_improvement:.2f}%")
    rows.append(f"- Cassandra average latency reduction: {avg_improvement:.2f}%")
    rows.append(f"- Both backends error rate: PostgreSQL={pg['http_req_failed_pct']:.2f}%, Cassandra={cs['http_req_failed_pct']:.2f}%")
    rows.append("")
    return "\n".join(rows)


def create_plots(df: pd.DataFrame) -> None:
    sns.set_theme(style="whitegrid", context="talk")
    colors = {"PostgreSQL": "#2B2D42", "Cassandra": "#2A9D8F"}

    fig, axes = plt.subplots(2, 2, figsize=(16, 11), constrained_layout=True)
    fig.patch.set_facecolor("#F7F7F5")

    metric_defs = [
        ("http_reqs_rate", "Throughput (req/s)"),
        ("http_req_duration_p95_ms", "p95 Latency (ms)"),
        ("http_req_duration_avg_ms", "Average Latency (ms)"),
        ("http_req_failed_pct", "Error Rate (%)"),
    ]

    for ax, (col, title) in zip(axes.flat, metric_defs):
        sns.barplot(data=df, x="backend", y=col, ax=ax, palette=colors)
        ax.set_title(title, pad=12, fontweight="bold")
        ax.set_xlabel("")
        ax.set_ylabel("")
        for p in ax.patches:
            height = p.get_height()
            ax.annotate(
                f"{height:.2f}",
                (p.get_x() + p.get_width() / 2.0, height),
                ha="center",
                va="bottom",
                fontsize=11,
                xytext=(0, 6),
                textcoords="offset points",
            )

    fig.suptitle("Lab 8 Benchmark Comparison: PostgreSQL vs Cassandra", fontsize=20, fontweight="bold")
    fig.savefig(OUT_PNG_MAIN, dpi=180)
    plt.close(fig)

    lat_cols = [
        "http_req_duration_min_ms",
        "http_req_duration_med_ms",
        "http_req_duration_p90_ms",
        "http_req_duration_p95_ms",
        "http_req_duration_max_ms",
    ]
    lat_df = df.melt(id_vars=["backend"], value_vars=lat_cols, var_name="metric", value_name="ms")
    metric_map = {
        "http_req_duration_min_ms": "min",
        "http_req_duration_med_ms": "median",
        "http_req_duration_p90_ms": "p90",
        "http_req_duration_p95_ms": "p95",
        "http_req_duration_max_ms": "max",
    }
    lat_df["metric"] = lat_df["metric"].map(metric_map)

    plt.figure(figsize=(14, 8), facecolor="#F7F7F5")
    ax = sns.lineplot(
        data=lat_df,
        x="metric",
        y="ms",
        hue="backend",
        marker="o",
        linewidth=3,
        palette=colors,
    )
    ax.set_title("Latency Profile Across Percentiles", fontsize=18, fontweight="bold", pad=12)
    ax.set_xlabel("Latency Statistic")
    ax.set_ylabel("Milliseconds")
    plt.legend(title="Backend")
    plt.tight_layout()
    plt.savefig(OUT_PNG_LAT, dpi=180)
    plt.close()


def create_dashboard_html(df: pd.DataFrame) -> None:
    payload = df.to_dict(orient="records")
    html = f"""<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Lab 8 Benchmark Dashboard</title>
  <script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>
  <style>
    :root {{
      --bg: #f4f1ea;
      --card: #ffffff;
      --ink: #1f2937;
      --pg: #2B2D42;
      --cs: #2A9D8F;
      --muted: #6b7280;
    }}
    body {{
      margin: 0;
      font-family: 'Trebuchet MS', 'Segoe UI', sans-serif;
      background: radial-gradient(circle at 20% 10%, #fff9ec 0%, var(--bg) 40%, #ece8df 100%);
      color: var(--ink);
    }}
    .wrap {{ max-width: 1200px; margin: 24px auto; padding: 0 16px; }}
    .hero {{
      background: linear-gradient(135deg, #1f2937 0%, #2a9d8f 100%);
      color: #fff;
      border-radius: 18px;
      padding: 20px 24px;
      box-shadow: 0 10px 25px rgba(0,0,0,.15);
    }}
    .grid {{
      margin-top: 16px;
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }}
    .card {{
      background: var(--card);
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 8px 20px rgba(0,0,0,.08);
    }}
    .k {{ font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }}
    .v {{ font-size: 30px; font-weight: 700; margin-top: 6px; }}
    .canvas-card {{ margin-top: 14px; background: #fff; border-radius: 14px; padding: 12px; box-shadow: 0 8px 20px rgba(0,0,0,.08); }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 14px; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,.08); }}
    th, td {{ padding: 10px; border-bottom: 1px solid #ececec; text-align: right; }}
    th:first-child, td:first-child {{ text-align: left; }}
    th {{ background: #fafafa; }}
  </style>
</head>
<body>
<div class=\"wrap\">
  <section class=\"hero\">
    <h1>Lab 8 DB Benchmark Dashboard</h1>
    <p>PostgreSQL vs Cassandra from k6 write-load summaries</p>
  </section>

  <section class=\"grid\" id=\"cards\"></section>

  <section class=\"canvas-card\"><canvas id=\"bar\" height=\"120\"></canvas></section>
  <section class=\"canvas-card\"><canvas id=\"lat\" height=\"110\"></canvas></section>

  <table id=\"tbl\"></table>
</div>

<script>
const data = {json.dumps(payload)};
const pg = data.find(d => d.backend === 'PostgreSQL');
const cs = data.find(d => d.backend === 'Cassandra');

const speedup = cs.http_reqs_rate / pg.http_reqs_rate;
const p95Red = ((pg.http_req_duration_p95_ms - cs.http_req_duration_p95_ms) / pg.http_req_duration_p95_ms) * 100;
const avgRed = ((pg.http_req_duration_avg_ms - cs.http_req_duration_avg_ms) / pg.http_req_duration_avg_ms) * 100;

const cards = [
  ['Cassandra Throughput', cs.http_reqs_rate.toFixed(2) + ' req/s'],
  ['PostgreSQL Throughput', pg.http_reqs_rate.toFixed(2) + ' req/s'],
  ['Throughput Speedup', speedup.toFixed(2) + 'x'],
  ['p95 Latency Reduction', p95Red.toFixed(2) + '%'],
  ['Average Latency Reduction', avgRed.toFixed(2) + '%'],
  ['Error Rate (both)', pg.http_req_failed_pct.toFixed(2) + '%'],
];

const cardsEl = document.getElementById('cards');
cards.forEach(([k,v]) => {{
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class=\"k\">${{k}}</div><div class=\"v\">${{v}}</div>`;
  cardsEl.appendChild(el);
}});

new Chart(document.getElementById('bar').getContext('2d'), {{
  type: 'bar',
  data: {{
    labels: ['Throughput req/s', 'Avg Latency ms', 'p95 Latency ms', 'Max Latency ms'],
    datasets: [
      {{ label: 'PostgreSQL', data: [pg.http_reqs_rate, pg.http_req_duration_avg_ms, pg.http_req_duration_p95_ms, pg.http_req_duration_max_ms], backgroundColor: '#2B2D42' }},
      {{ label: 'Cassandra', data: [cs.http_reqs_rate, cs.http_req_duration_avg_ms, cs.http_req_duration_p95_ms, cs.http_req_duration_max_ms], backgroundColor: '#2A9D8F' }}
    ]
  }},
  options: {{ responsive: true, plugins: {{ legend: {{ position: 'top' }} }} }}
}});

new Chart(document.getElementById('lat').getContext('2d'), {{
  type: 'line',
  data: {{
    labels: ['min','median','p90','p95','max'],
    datasets: [
      {{ label: 'PostgreSQL', data: [pg.http_req_duration_min_ms, pg.http_req_duration_med_ms, pg.http_req_duration_p90_ms, pg.http_req_duration_p95_ms, pg.http_req_duration_max_ms], borderColor: '#2B2D42', tension: 0.25 }},
      {{ label: 'Cassandra', data: [cs.http_req_duration_min_ms, cs.http_req_duration_med_ms, cs.http_req_duration_p90_ms, cs.http_req_duration_p95_ms, cs.http_req_duration_max_ms], borderColor: '#2A9D8F', tension: 0.25 }}
    ]
  }},
  options: {{ responsive: true }}
}});

const rows = [
  ['Metric','PostgreSQL','Cassandra'],
  ['Requests/sec', pg.http_reqs_rate.toFixed(2), cs.http_reqs_rate.toFixed(2)],
  ['Total requests', pg.http_reqs_total.toFixed(0), cs.http_reqs_total.toFixed(0)],
  ['Avg latency (ms)', pg.http_req_duration_avg_ms.toFixed(2), cs.http_req_duration_avg_ms.toFixed(2)],
  ['p90 latency (ms)', pg.http_req_duration_p90_ms.toFixed(2), cs.http_req_duration_p90_ms.toFixed(2)],
  ['p95 latency (ms)', pg.http_req_duration_p95_ms.toFixed(2), cs.http_req_duration_p95_ms.toFixed(2)],
  ['Max latency (ms)', pg.http_req_duration_max_ms.toFixed(2), cs.http_req_duration_max_ms.toFixed(2)],
  ['Error rate (%)', pg.http_req_failed_pct.toFixed(2), cs.http_req_failed_pct.toFixed(2)]
];
const tbl = document.getElementById('tbl');
rows.forEach((r, idx) => {{
  const tr = document.createElement('tr');
  r.forEach(c => {{
    const cell = document.createElement(idx === 0 ? 'th' : 'td');
    cell.textContent = c;
    tr.appendChild(cell);
  }});
  tbl.appendChild(tr);
}});
</script>
</body>
</html>
"""
    OUT_HTML.write_text(html, encoding="utf-8")


def main() -> None:
    df = pd.DataFrame(
        [
            parse_k6_summary(POSTGRES_FILE, "PostgreSQL"),
            parse_k6_summary(CASSANDRA_FILE, "Cassandra"),
        ]
    )

    df.to_csv(OUT_CSV, index=False)
    OUT_JSON.write_text(df.to_json(orient="records", indent=2), encoding="utf-8")

    md = build_markdown(df)
    OUT_MD.write_text(md, encoding="utf-8")

    create_plots(df)
    create_dashboard_html(df)

    print("Generated files:")
    for p in [OUT_CSV, OUT_JSON, OUT_MD, OUT_PNG_MAIN, OUT_PNG_LAT, OUT_HTML]:
        print(p)


if __name__ == "__main__":
    main()
