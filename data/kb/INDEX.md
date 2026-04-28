# Davo-AI · Medical Knowledge Base

> RAG-ready medical knowledge для AI-чата о побочных эффектах.
> Источники: WHO TB Treatment Guidelines 2024, FDA labels, BNF, Cochrane reviews.

## Содержание

### TB препараты (RHZE)
- [rifampicin.md](drugs/rifampicin.md) — Rifampicin / Рифампицин / Рифампицин
- [isoniazid.md](drugs/isoniazid.md) — Isoniazid / Изониазид
- [pyrazinamide.md](drugs/pyrazinamide.md) — Pyrazinamide / Пиразинамид
- [ethambutol.md](drugs/ethambutol.md) — Ethambutol / Этамбутол

### Состояния и протоколы
- [tb_treatment_uz.md](conditions/tb_treatment_uz.md) — TB лечение в Узбекистане (национальный протокол)
- [red_flags.md](conditions/red_flags.md) — критические симптомы (escalation)
- [pediatric_tb.md](conditions/pediatric_tb.md) — педиатрический TB (post-MVP)

## Использование в RAG

```python
# Псевдокод для будущей интеграции с Aya 32B
from pathlib import Path

def load_drug_knowledge(drugs: list[str]) -> str:
    kb = []
    for drug in drugs:
        path = Path(f"data/kb/drugs/{drug}.md")
        if path.exists():
            kb.append(path.read_text())
    return "\n\n---\n\n".join(kb)

system_prompt = f"""
{TB_SYSTEM_PROMPT}

ZNANIYE BAZASI (использовать для контекста):
{load_drug_knowledge(patient.drugs)}
"""
```

## Embeddings (post-MVP)

Для семантического поиска по KB:
- Модель: **BGE-M3** (multi-lingual, скачивается setup_dgx_spark)
- Vector DB: pgvector (расширение Postgres) или Chroma
- Chunking: по разделам markdown (`##` headers)
