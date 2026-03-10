

# Plan: Differentiate Top Score PF vs Basic PF Sections in SerasaDetailView

## Problem
Currently, `SerasaDetailView` renders all sections for every Serasa report type. The Basic PF and Top Score PF show the same sections even though the Basic PF report shouldn't display Score, Renda Estimada, Ações Judiciais, or Participação em Falência sections.

## What Each Report Should Show

**Relatório Básico PF:**
- Header, Identificação Cadastral
- Anotações Negativas (Pefin, Refin, Convem, Protestos, Cheques)
- Participações Societárias
- Documentos Roubados
- Consultas à Serasa

**Relatório Top Score PF PME (additional sections):**
- Everything from Basic PF, plus:
- Serasa Score (with HRLD model)
- Renda Estimada
- Ações Judiciais
- Participação em Falência
- Cheques Sustados
- Up to 99 annotations per negative block

## Changes

### 1. Pass `consultaId` to SerasaDetailView
In `ConsultaExecution.tsx`, pass `detailResult.id` as a new `consultaId` prop to `SerasaDetailView`.

### 2. Update SerasaDetailView to conditionally render sections
- Add `consultaId` prop to the component interface
- Determine if report is "top score" (`consultaId === 'serasa_avancado_top_score_pf'`)
- **Score section**: Only show for Top Score
- **Score in pinned info cards**: Only show score value for Top Score; for Basic show just the other cards
- **Renda Estimada**: Only show for Top Score
- **Ações Judiciais**: Only show for Top Score
- **Participação em Falência**: Only show for Top Score
- **Cheques Sustados**: Only show for Top Score

### 3. Also handle history view
Check `ConsultaHistoryPage.tsx` to ensure `consultaId` is passed when viewing saved results from history.

