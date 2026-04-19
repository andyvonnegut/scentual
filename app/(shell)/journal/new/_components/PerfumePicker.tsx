"use client";

import { useMemo, useState } from "react";

type Perfume = {
  id: number;
  name: string;
  manufacturer: { id: number; name: string } | null;
};

type House = { id: number; name: string };

export function PerfumePicker({
  perfumes,
  houses,
}: {
  perfumes: Perfume[];
  houses: House[];
}) {
  const [houseName, setHouseName] = useState("");
  const [perfumeName, setPerfumeName] = useState("");

  const selectedHouse = useMemo(() => {
    const t = houseName.trim().toLowerCase();
    if (!t) return null;
    return houses.find((h) => h.name.toLowerCase() === t) ?? null;
  }, [houseName, houses]);

  const filteredPerfumes = useMemo(() => {
    if (selectedHouse) {
      return perfumes.filter(
        (p) => p.manufacturer?.id === selectedHouse.id,
      );
    }
    return perfumes;
  }, [perfumes, selectedHouse]);

  const perfumeId = useMemo(() => {
    const t = perfumeName.trim().toLowerCase();
    if (!t) return "";
    const match = filteredPerfumes.find(
      (p) => p.name.toLowerCase() === t,
    );
    return match ? String(match.id) : "";
  }, [perfumeName, filteredPerfumes]);

  return (
    <>
      <label className="flex flex-col gap-2">
        <span className="micro-label">House (optional filter)</span>
        <input
          list="house-options"
          value={houseName}
          onChange={(e) => {
            setHouseName(e.target.value);
            setPerfumeName("");
          }}
          placeholder="Start typing a house…"
          className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
        />
        <datalist id="house-options">
          {houses.map((h) => (
            <option key={h.id} value={h.name} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-2">
        <span className="micro-label">
          Perfume{selectedHouse ? ` · ${filteredPerfumes.length} in ${selectedHouse.name}` : ` · ${perfumes.length} total`}
        </span>
        <input
          list="perfume-options"
          value={perfumeName}
          onChange={(e) => setPerfumeName(e.target.value)}
          required
          placeholder="Start typing a perfume name…"
          className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
        />
        <datalist id="perfume-options">
          {filteredPerfumes.map((p) => (
            <option key={p.id} value={p.name}>
              {p.manufacturer?.name ?? ""}
            </option>
          ))}
        </datalist>
        <input type="hidden" name="perfume_id" value={perfumeId} required />
        {perfumeName && !perfumeId && (
          <span className="text-xs text-[color:var(--warning)]">
            Pick a perfume from the list.
          </span>
        )}
      </label>
    </>
  );
}
