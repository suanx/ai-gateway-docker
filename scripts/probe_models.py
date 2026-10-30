#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 网关 通用模型探测脚本
================================
支持任意上游（kilo / groq / llm7 / nvidia / pollinations / aihorde），
自动拉模型列表 → 按上游规则过滤 → 按能力分类 → 逐个实测延迟。

用法：
    python3 probe_models.py                          # 默认测 kilo
    python3 probe_models.py --provider groq
    python3 probe_models.py --provider pollinations --only image,tts
    python3 probe_models.py --limit 0                # 不限量（测全部）
    python3 probe_models.py --workers 6              # 提高并发
    python3 probe_models.py --direct                 # 绕过网关，直连上游

结果同时输出到终端和 /tmp/probe_<provider>.json
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import concurrent.futures as cf

# ---------- 配置 ----------
DEFAULT_HOST = "http://127.0.0.1:3002"
DEFAULT_ACCESS_KEY = "sk-525cdcdd628cf"

TIMEOUT = 45
WORKERS = 4
LIMIT = 25          # 每类上限，0 = 不限

# 上游直连地址（仅 --direct 时用）
DIRECT_BASE = {
    "groq":         "https://api.groq.com/openai/v1",
    "llm7":         "https://api.llm7.io/v1",
    "kilo":         "https://api.kilo.ai/api/gateway",
    "nvidia":       "https://integrate.api.nvidia.com/v1",
    "pollinations": "https://gen.pollinations.ai/v1",
    "aihorde":      "https://oai.aihorde.net/v1",
}

# ---------- 上游专属规则 ----------
# kilo: 网关对不带 :free 后缀的模型会强制替换成 kilo-auto/free，
#       所以测它们没有意义（都会变成同一个模型）。只测 :free 才是真实可路由的。
PROVIDER_RULES = {
    "kilo": {
        # 免费档两种写法都要认：nvidia/xxx:free 和 kilo-auto/free
        "filter":  lambda m: m.endswith(":free") or re.search(r"/free$", m),
        "reason":  "网关要求免费模型 ID 带 free 标记（:free 或 /free），"
                   "否则会被强制替换成 kilo-auto/free，测了也没意义",
        "sort":    lambda ms: sorted(ms),
    },
    "aihorde": {
        # 志愿算力，队列慢，超时放宽
        "timeout": 120,
    },
    "pollinations": {
        "timeout": 45,
    },
}

# ---------- 能力分类 ----------
RULES = [
    ("image",     r"image|flux|nanobanana|banana|seedream|kontext|gptimage|imagen|dall|z-image|midjourney|recraft"),
    ("video",     r"video|seedance|veo|wan-|kling|hailuo|animate"),
    ("stt",       r"transcribe|whisper|stt|asr"),
    ("tts",       r"tts|speech|eleven|audio.*flash|voice"),
    ("embedding", r"embed"),
    ("3d",        r"trellis|3d|mesh"),
]
CHAT = "chat"
ORDER = [CHAT, "image", "tts", "stt", "embedding", "video", "3d"]


def classify(mid):
    m = mid.lower()
    for kind, pat in RULES:
        if re.search(pat, m):
            return kind
    return CHAT


def build_request(kind, model):
    if kind == CHAT:
        return ("POST", "/chat/completions", {
            "model": model,
            "messages": [{"role": "user", "content": "say OK"}],
            "max_tokens": 16,
        })
    if kind == "image":
        return ("POST", "/images/generations", {
            "model": model, "prompt": "a red circle on white background",
            "width": 512, "height": 512, "n": 1, "response_format": "url",
        })
    if kind == "tts":
        return ("POST", "/audio/speech", {
            "model": model, "input": "Hello from Pollinations",
            "voice": "alloy", "response_format": "mp3",
        })
    if kind == "embedding":
        return ("POST", "/embeddings", {"model": model, "input": "Hello world"})
    return None   # video / stt / 3d：网关只代理 /v1/* 标准端点


# ---------- HTTP ----------
def http_call(url, method, body, headers, timeout):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return {"ok": True, "status": r.status, "ttfb": time.time() - t0,
                    "ctype": (r.headers.get("Content-Type") or "").split(";")[0].strip(),
                    "raw": raw, "elapsed": time.time() - t0}
    except urllib.error.HTTPError as e:
        raw = b""
        try:
            raw = e.read()
        except Exception:
            pass
        return {"ok": False, "status": e.code, "ttfb": time.time() - t0,
                "ctype": "", "raw": raw, "elapsed": time.time() - t0}
    except Exception as e:
        return {"ok": False, "status": 0, "ttfb": time.time() - t0,
                "ctype": "", "raw": str(e).encode(), "elapsed": time.time() - t0}


# ---------- 判定 ----------
def judge(kind, r):
    raw = r["raw"] or b""
    txt = raw[:400].decode("utf-8", "ignore")

    if not r["ok"]:
        msg = txt
        try:
            j = json.loads(raw.decode("utf-8", "ignore"))
            e = j.get("error", {})
            msg = e.get("message") or json.dumps(j)[:120]
        except Exception:
            pass
        return False, "HTTP %s · %s" % (r["status"], msg[:70])

    ct = r["ctype"] or ""
    if ct.startswith("audio/") or ct.startswith("video/") or ct.startswith("image/"):
        if len(raw) > 500:
            return True, "%s · %.1fKB" % (ct, len(raw) / 1024)
        return False, "%s · 内容过小 %dB" % (ct, len(raw))

    try:
        j = json.loads(raw.decode("utf-8", "ignore"))
    except Exception:
        return False, "非 JSON · " + txt[:60]

    if kind == CHAT:
        try:
            c = j["choices"][0]["message"]["content"]
            return True, (c or "").strip().replace("\n", " ")[:28] or "(空回复)"
        except Exception:
            try:
                return True, str(j["choices"][0]["text"])[:28]
            except Exception:
                return False, "无 choices · " + json.dumps(j)[:70]

    if kind == "image":
        try:
            d = j.get("data") or []
            if not d:
                return False, "无 data · " + json.dumps(j)[:70]
            it = d[0]
            if it.get("url"):
                return True, "url " + str(it["url"])[:44]
            if it.get("b64_json"):
                return True, "b64 %.0fKB" % (len(it["b64_json"]) / 1024 * 0.75)
            return False, "data 无 url/b64"
        except Exception:
            return False, "解析失败"

    if kind == "embedding":
        try:
            v = j["data"][0]["embedding"]
            return True, "dim=%d" % len(v)
        except Exception:
            return False, "无 embedding"

    if kind == "tts":
        return False, "返回 JSON 而非音频 · " + json.dumps(j)[:60]

    return True, "ok"


# ---------- 主流程 ----------
def main():
    args = sys.argv[1:]
    provider = "kilo"
    direct = False
    only = None
    limit = LIMIT
    workers = WORKERS
    timeout = TIMEOUT

    for a in args:
        if a.startswith("--provider="):
            provider = a.split("=", 1)[1]
        elif a.startswith("--only="):
            only = set(a.split("=", 1)[1].split(","))
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--workers="):
            workers = int(a.split("=", 1)[1])
        elif a.startswith("--timeout="):
            timeout = int(a.split("=", 1)[1])
        elif a == "--direct":
            direct = True

    rule = PROVIDER_RULES.get(provider, {})
    timeout = rule.get("timeout", timeout)

    if direct:
        base = DIRECT_BASE.get(provider)
        if not base:
            print("❌ 未知上游: %s" % provider)
            return 1
    else:
        base = "%s/%s/v1" % (DEFAULT_HOST, provider)

    key = os.environ.get("ACCESS_KEY", "") or DEFAULT_ACCESS_KEY
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key

    print("=" * 74)
    print("模型探测 · 上游 = %s" % provider)
    print("  端点: %s" % base)
    print("  认证: %s" % ("Bearer " + key[:8] + "…" if key else "匿名"))
    print("  并发: %d · 超时: %ds" % (workers, timeout))
    print("=" * 74)

    # 1. 拉列表
    print("\n[1/4] 拉取模型列表…")
    r = http_call(base + "/models", "GET", None, headers, timeout)
    if not r["ok"]:
        print("  ❌ 拉取失败: HTTP %s" % r["status"])
        print("     %s" % r["raw"][:300].decode("utf-8", "ignore"))
        return 1

    try:
        models = json.loads(r["raw"].decode("utf-8"))["data"]
        mids = sorted({(m.get("id") or "") for m in models if m.get("id")})
    except Exception as e:
        print("  ❌ 解析失败: %s" % e)
        return 1
    print("  共 %d 个" % len(mids))

    # 2. 上游规则过滤
    print("\n[2/4] 上游规则过滤…")
    if "filter" in rule:
        before = len(mids)
        mids = [m for m in mids if rule["filter"](m)]
        print("  %s" % rule.get("reason", ""))
        print("  %d → %d 个（剔除 %d 个）" % (before, len(mids), before - len(mids)))
    else:
        print("  无专属规则，全部保留")

    if not mids:
        print("\n❌ 过滤后没有可测模型")
        return 1

    # 3. 分类
    buckets = {}
    for m in mids:
        buckets.setdefault(classify(m), []).append(m)
    print("\n[3/4] 能力分类:")
    for k in ORDER:
        if k in buckets:
            print("    %-10s %3d 个" % (k, len(buckets[k])))

    # 4. 实测
    tasks = []
    for k in ORDER:
        if k not in buckets or (only and k not in only):
            continue
        lst = buckets[k]
        if limit:
            lst = lst[:limit]
        for m in lst:
            tasks.append((k, m))

    print("\n[4/4] 实测 %d 个…" % len(tasks))
    if limit:
        print("      （每类上限 %d，用 --limit 0 可测全部）" % limit)
    print("-" * 74)

    results = {k: [] for k in ORDER}

    def run(task):
        kind, model = task
        req = build_request(kind, model)
        if req is None:
            return kind, model, False, "网关不代理该类型端点", 0
        method, path, body = req
        r = http_call(base + path, method, body, headers, timeout)
        ok, note = judge(kind, r)
        return kind, model, ok, note, r["elapsed"]

    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for kind, model, ok, note, el in ex.map(run, tasks):
            print("  %s [%-9s] %-38s %5.1fs  %s"
                  % ("✅" if ok else "✗ ", kind, model[:38], el, note))
            sys.stdout.flush()
            results[kind].append({"model": model, "ok": ok,
                                  "elapsed": round(el, 2), "note": note})

    # ---------- 汇总 ----------
    print("\n" + "=" * 74)
    print("汇总 · %s" % provider)
    print("=" * 74)

    available = {}
    for k in ORDER:
        lst = results.get(k) or []
        if not lst:
            continue
        good = [x for x in lst if x["ok"]]
        available[k] = good
        print("\n【%s】 %d/%d 可用" % (k, len(good), len(lst)))
        if good:
            good.sort(key=lambda x: x["elapsed"])
            for x in good[:15]:
                print("    %5.1fs  %s" % (x["elapsed"], x["model"]))
            if len(good) > 15:
                print("    … 还有 %d 个" % (len(good) - 15))
        bad = [x for x in lst if not x["ok"]]
        if bad:
            print("    失败样本: %s" % bad[0]["note"][:66])

    out = {
        "provider": provider,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "endpoint": base,
        "available": {k: [x["model"] for x in v] for k, v in available.items()},
        "detail": results,
    }
    fn = "/tmp/probe_%s.json" % provider
    with open(fn, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n完整结果: %s" % fn)

    print("\n" + "=" * 74)
    print("客户端填法")
    print("=" * 74)
    host = "https://llm.suen.us.ci"
    for k in [CHAT, "image", "tts", "embedding"]:
        if available.get(k):
            print("  %-9s → %s/%s/v1   模型: %s"
                  % (k, host, provider, available[k][0]["model"]))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n已中断")
        sys.exit(130)
