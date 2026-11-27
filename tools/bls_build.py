#!/usr/bin/env python3
"""Wandelt den Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut, CC BY 4.0)
in die kompakte Datei bls.json um, die die App lädt.

Quelle: https://blsdb.de/download  (BLS_4_0_2025_DE.zip -> BLS_4_0_Daten_2025_DE.xlsx)
Aufruf: python3 tools/bls_build.py pfad/zu/BLS_4_0_Daten_2025_DE.xlsx bls.json
"""
import json, math, sys
import openpyxl

# App-Schlüssel (Reihenfolge wie NUTR in data.js) -> (BLS-Codes, Faktor auf App-Einheit)
MAP = {
 "kcal": (["ENERCC"], 1), "p": (["PROT625"], 1), "c": (["CHO"], 1), "f": (["FAT"], 1),
 "fib": (["FIBT"], 1), "sug": (["SUGAR"], 1), "sfa": (["FASAT"], 1),
 "vA": (["VITA"], 1), "vD": (["VITD"], 1), "vE": (["VITE"], 1), "vK": (["VITK"], 1),
 "vC": (["VITC"], 1), "b1": (["THIA"], 1), "b2": (["RIBF"], 1), "b3": (["NIAEQ"], 1),
 "b5": (["PANTAC"], 1), "b6": (["VITB6"], 0.001), "b7": (["BIOT"], 1), "b9": (["FOL"], 1),
 "b12": (["VITB12"], 1), "cho": None,
 "ca": (["CA"], 1), "ph": (["P"], 1), "mg": (["MG"], 1), "na": (["NA"], 1),
 "k": (["K"], 1), "fe": (["FE"], 1), "zn": (["ZN"], 1), "cu": (["CU"], 0.001),
 "mn": (["MN"], 0.001), "se": None, "io": (["ID"], 1),
 "o3": (["F20:5CN3", "F22:6CN3"], 1), "ala": (["F18:3CN3"], 1),
 "poly": None, "lut": None, "lyc": None, "cr": None,
}

def rnd(v):
    if v is None: return None
    if v == 0: return 0
    d = max(0, 3 - int(math.floor(math.log10(abs(v)))) - 1)
    r = round(v, d)
    return int(r) if r == int(r) else r

def main(src, out):
    ws = openpyxl.load_workbook(src, read_only=True).active
    rows = ws.iter_rows(values_only=True)
    hdr = next(rows)
    col = {h.split(" ")[0]: i for i, h in enumerate(hdr) if h and "[" in h}
    keys = list(MAP)
    foods = []
    for r in rows:
        if not r[0]: continue
        vals = []
        for k in keys:
            spec = MAP[k]
            if spec is None: vals.append(None); continue
            codes, fac = spec
            xs = [r[col[c]] for c in codes]
            if any(x is None or isinstance(x, str) for x in xs): vals.append(None); continue
            vals.append(rnd(sum(xs) * fac))
        foods.append([r[0], r[1].strip(), vals])
    data = {"src": "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0. DOI 10.25826/Data20251217-134202-0. Lizenz CC BY 4.0",
            "v": "4.0", "k": keys, "d": foods}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(foods), "Lebensmittel ->", out)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
