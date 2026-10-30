#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pollinations 全类型模型探测脚本
================================
按模型能力自动分类（聊天 / 图像 / TTS / STT / 嵌入 / 视频），
用对应端点逐个实测，记录真实延迟，区分「成功且快」和「报错但快」。

用法：
    python3 probe_pollinations.py                       # 自动读环境变量
    python3 probe_pollinations.py <ACCESS_KEY>          # 直连本机网关
    python3 probe_pollinations.py <KEY> --direct        # 直连 pollinations（不经网关）
    python3 probe_pollinations.py <KEY> --only chat,tts # 只测指定类别
    python3 probe_pollinations.py <KEY> --limit 20      # 每类最多测 20 个
    python3 probe_pollinations.py <KEY> --workers 4     # 并发数（默认 3）

结果同时输出到终端和 /tmp/pollinations_probe.json
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
PROVIDER = "pollinations"
DIRECT_BASE = "https://gen.pollinations.ai/v1"

TIMEOUT = 45          # 单个请求超时（秒）
WORKERS = 3           # 并发数
LIMIT = 0             # 每类上限，0=不限

# ---------- 分类规则 ----------
# 注意顺序：越特殊的放前面
RULES = [
    ("image",     r"image|flux|nanobanana|banana|seedream|kontext|gptimage|imagen|dall|z-image|midjourney|recraft"),
    ("video",     r"video|seedance|veo|wan-|kling|hailuo|animate"),
    ("stt",       r"transcribe|whisper|stt|asr"),
    ("tts",       r"tts|speech|eleven|audio.*flash|voice"),
    ("embedding", r"embed"),
    ("3d",        r"trellis|3d|mesh"),
]
CHAT = "chat"

def classify(mid):
    m = mid.lower()
    for kind, pat in RULES:
        if re.search(pat, m):
            return kind
    return CHAT

# 各类测试用的请求构造：(方法, 路径后缀, body dict)
def build_request(kind, model):
    if kind == CHAT:
        return ("POST", "/chat/completions", {
            "model": model,
            "messages": [{"role": "user", "content": "say OK"}],
            "max_tokens": 16,
        })
    if kind == "image":
        return ("POST", "/images/generations", {
            "model": model,
            "prompt": "a red circle on white background",
            "width": 512, "height": 512, "n": 1,
            "response_format": "url",
        })
    if kind == "tts":
        return ("POST", "/audio/speech", {
            "model": model,
            "input": "Hello from Pollinations",
            "voice": "alloy",
            "response_format": "mp3",
        })
    if kind == "embedding":
        return ("POST", "/embeddings", {
            "model": model,
            "input": "Hello world",
        })
    # video / stt / 3d：网关只代理 /v1/*，这几类的非标准端点无法透传，
    # 标记为 skip，避免误判成「模型不可用」
    return None

# ---------- HTTP ----------
def http_call(url, method, body, headers, timeout):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            ttfb = time.time() - t0
            return {
                "ok": True, "status": r.status, "ttfb": ttfb,
                "ctype": (r.headers.get("Content-Type") or "").split(";")[0].strip(),
                "raw": raw, "elapsed": time.time() - t0,
            }
    except urllib.error.HTTPError as e:
        raw = b""
        try:
            raw = e.read()
        except Exception:
            pass
        return {
            "ok": False, "status": e.code, "ttfb": time.time() - t0,
            "ctype": "", "raw": raw, "elapsed": time.time() - t0,
        }
    except Exception as e:
        return {
            "ok": False, "status": 0, "ttfb": time.time() - t0,
            "ctype": "", "raw": str(e).encode(), "elapsed": time.time() - t0,
        }

# ---------- 结果判定 ----------
def judge(kind, r):
    """返回 (是否成功, 摘要)"""
    raw = r["raw"] or b""
    txt = raw[:400].decode("utf-8", "ignore")

    if not r["ok"]:
        # 提取上游错误信息
        msg = txt
        try:
            j = json.loads(raw.decode("utf-8", "ignore"))
            e = j.get("error", {})
            msg = e.get("message") or json.dumps(j)[:120]
        except Exception:
            pass
        return False, "HTTP %s · %s" % (r["status"], msg[:70])

    ct = r["ctype"] or ""

    # 二进制响应（音频/图像直出）
    if ct.startswith("audio/") or ct.startswith("video/") or ct.startswith("image/"):
        if len(raw) > 500:
            return True, "%s · %.1fKB" % (ct, len(raw) / 1024)
        return False, "%s · 内容过小 %dB" % (ct, len(raw))

    # JSON 响应
    try:
        j = json.loads(raw.decode("utf-8", "ignore"))
    except Exception:
        return False, "非 JSON 响应 · " + txt[:60]

    if kind == CHAT:
        try:
            c = j["choices"][0]["message"]["content"]
            return True, (c or "").strip().replace("\n", " ")[:28] or "(空回复)"
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
        # 若返回 JSON 而非音频，说明该模型不走 /audio/speech
        return False, "返回 JSON 而非音频 · " + json.dumps(j)[:60]

    return True, "ok"


# ---------- 主流程 ----------
def main():
    args = [a for a in sys.argv[1:]]
    key = os.environ.get("ACCESS_KEY", "")
    direct = "--direct" in args
    only = None
    limit = LIMIT
    workers = WORKERS

    for a in args:
        if a.startswith("--only="):
            only = set(a.split("=", 1)[1].split(","))
        elif a.startswith("--limit="):
            limit = int(a.split("=", 1)[1])
        elif a.startswith("--workers="):
            workers = int(a.split("=", 1)[1])
        elif not a.startswith("--") and not key:
            key = a

    base = DIRECT_BASE if direct else "%s/%s/v1" % (DEFAULT_HOST, PROVIDER)
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key

    print("=" * 74)
    print("Pollinations 模型探测")
    print("  端点: %s" % base)
    print("  认证: %s" % ("Bearer " + key[:8] + "…" if key else "匿名"))
    if only:
        print("  类别: %s" % ",".join(sorted(only)))
    print("=" * 74)

    # 1. 拉模型列表
    print("\n[1/3] 拉取模型列表…")
    r = http_call(base + "/models", "GET", None, headers, TIMEOUT)
    if not r["ok"]:
        print("  ❌ 拉取失败: HTTP %s" % r["status"])
        print("     %s" % (r["raw"][:300].decode("utf-8", "ignore")))
        print("\n提示：若走网关失败，试试 --direct 直连（需要网络可达）")
        return 1

    try:
        models = json.loads(r["raw"].decode("utf-8"))["data"]
        mids = sorted({(m.get("id") or "") for m in models if m.get("id")})
    except Exception as e:
        print("  ❌ 解析失败: %s" % e)
        return 1

    print("  共 %d 个模型" % len(mids))

    # 2. 分类
    buckets = {}
    for m in mids:
        k = classify(m)
        buckets.setdefault(k, []).append(m)

    print("\n[2/3] 能力分类:")
    order = [CHAT, "image", "tts", "stt", "embedding", "video", "3d"]
    for k in order:
        if k in buckets:
            print("    %-10s %3d 个" % (k, len(buckets[k])))

    # 3. 测试
    tasks = []
    for k in order:
        if k not in buckets:
            continue
        if only and k not in only:
            continue
        lst = buckets[k]
        if limit:
            lst = lst[:limit]
        for m in lst:
            tasks.append((k, m))

    print("\n[3/3] 实测 %d 个（并发 %d，超时 %ds）…" % (len(tasks), workers, TIMEOUT))
    print("-" * 74)

    results = {k: [] for k in order}

    def run(task):
        kind, model = task
        req = build_request(kind, model)
        if req is None:
            return kind, model, None, False, "网关不代理该类型端点", 0
        method, path, body = req
        r = http_call(base + path, method, body, headers, TIMEOUT)
        ok, note = judge(kind, r)
        return kind, model, r, ok, note, r["elapsed"]

    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for kind, model, r, ok, note, el in ex.map(run, tasks):
            mark = "✅" if ok else "✗ "
            print("  %s [%-9s] %-34s %5.1fs  %s" % (mark, kind, model[:34], el, note))
            sys.stdout.flush()
            results[kind].append({
                "model": model, "ok": ok, "elapsed": round(el, 2), "note": note,
            })

    # ---------- 汇总 ----------
    print("\n" + "=" * 74)
    print("汇总")
    print("=" * 74)

    available = {}
    for k in order:
        lst = results.get(k) or []
        if not lst:
            continue
        good = [x for x in lst if x["ok"]]
        available[k] = good
        print("\n【%s】 %d/%d 可用" % (k, len(good), len(lst)))
        if good:
            good.sort(key=lambda x: x["elapsed"])
            for x in good[:12]:
                print("    %5.1fs  %s" % (x["elapsed"], x["model"]))
            if len(good) > 12:
                print("    … 还有 %d 个" % (len(good) - 12))
        # 失败原因抽样（避免把「报错快」误当成「响应快」）
        bad = [x for x in lst if not x["ok"]]
        if bad:
            print("    失败样本: %s" % bad[0]["note"][:66])

    # 保存
    out = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "endpoint": base,
        "available": {k: [x["model"] for x in v] for k, v in available.items()},
        "detail": results,
    }
    with open("/tmp/pollinations_probe.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n完整结果: /tmp/pollinations_probe.json")

    # 客户端配置建议
    print("\n" + "=" * 74)
    print("客户端填法")
    print("=" * 74)
    host = DEFAULT_HOST if not direct else "https://gen.pollinations.ai"
    for k in [CHAT, "image", "tts", "embedding"]:
        if available.get(k):
            print("  %-9s → %s/%s/v1   模型: %s" % (
                k, host if not direct else host, PROVIDER if not direct else "",
                available[k][0]["model"]))
    print("\n  图像端点示例: POST /pollinations/v1/images/generations")
    print("  TTS  端点示例: POST /pollinations/v1/audio/speech")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n已中断")
        sys.exit(130)
