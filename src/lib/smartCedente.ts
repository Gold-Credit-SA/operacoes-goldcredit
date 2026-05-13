export function transformSmartCedenteData(externalData: any) {
  const cedente = externalData?.cedente || {};
  const operacoes = externalData?.operacoes || [];
  const titulosAberto = externalData?.titulosAberto || [];
  const titulosQuitados = externalData?.titulosQuitados || [];
  const receitas = externalData?.receitas || [];
  const recomprados = externalData?.recomprados || [];
  const suspeitaFraude = externalData?.suspeitaFraude || [];

  const totalOperacoes = operacoes.length;
  const valorBrutoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_bruto) || 0), 0);
  const valorLiquidoTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.valor_liquido) || 0), 0);
  // Receita gerada vem da tabela smartsecurities_receita_por_cedente (campo total),
  // não de operacoes.valor_receita (que costuma vir zerado).
  const receitaTotal = receitas.reduce((acc: number, r: any) => acc + (parseFloat(r.total) || 0), 0);
  const prazoMedioTotal = operacoes.reduce((acc: number, op: any) => acc + (parseFloat(op.prazo_medio) || 0), 0);

  const taxasOperacoes = operacoes
    .filter((op: any) => {
      const bruto = parseFloat(op.valor_bruto) || 0;
      const prazo = parseFloat(op.prazo_medio) || 0;
      return bruto > 0 && prazo > 0;
    })
    .map((op: any) => {
      const bruto = parseFloat(op.valor_bruto);
      const liquido = parseFloat(op.valor_liquido) || 0;
      const desagio = bruto - liquido;
      const prazo = parseFloat(op.prazo_medio);
      return (desagio / bruto / prazo) * 30 * 100;
    });

  const taxaMediaCalc = taxasOperacoes.length > 0
    ? taxasOperacoes.reduce((acc: number, t: number) => acc + t, 0) / taxasOperacoes.length
    : 0;

  const carteiraTotal = titulosAberto.reduce((acc: number, t: any) => acc + (parseFloat(t.valor) || 0), 0);
  const hoje = new Date();
  const titulosVencidos = titulosAberto.filter((t: any) => t.vencimento && new Date(t.vencimento) < hoje);
  const carteiraVencida = titulosVencidos.reduce((acc: number, t: any) => acc + (parseFloat(t.valor) || 0), 0);

  const valorQuitadoTotal = titulosQuitados.reduce((acc: number, t: any) => acc + (parseFloat(t.valor_face) || 0), 0);
  const valorRecompradoTotal = recomprados.reduce((acc: number, t: any) => acc + (parseFloat(t.valor_face) || 0), 0);
  const totalTitulosHistorico = titulosQuitados.length + recomprados.length;

  let pontualQtd = 0;
  let pontualValor = 0;
  let atrasoQtd = 0;
  let atrasoValor = 0;

  titulosQuitados.forEach((t: any) => {
    const vencimento = t.vencimento ? new Date(t.vencimento) : null;
    const quitacao = t.quitacao ? new Date(t.quitacao) : null;
    const valorFace = parseFloat(t.valor_face) || 0;

    if (vencimento && quitacao) {
      const diffDays = Math.floor((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        pontualQtd++;
        pontualValor += valorFace;
      } else {
        atrasoQtd++;
        atrasoValor += valorFace;
      }
    } else {
      pontualQtd++;
      pontualValor += valorFace;
    }
  });

  const percentualPontual = totalTitulosHistorico > 0 ? (pontualQtd / totalTitulosHistorico) * 100 : 0;
  const percentualAtraso = totalTitulosHistorico > 0 ? (atrasoQtd / totalTitulosHistorico) * 100 : 0;
  const percentualRecompra = totalTitulosHistorico > 0 ? (recomprados.length / totalTitulosHistorico) * 100 : 0;
  const percentualLiquidado = totalTitulosHistorico > 0 ? (titulosQuitados.length / totalTitulosHistorico) * 100 : 100;

  const sacadoMap = new Map<string, { nome: string; cpf_cnpj: string; valor: number }>();
  titulosAberto.forEach((t: any) => {
    if (t.cpf_cnpj_sacado) {
      const existing = sacadoMap.get(t.cpf_cnpj_sacado);
      if (existing) {
        existing.valor += parseFloat(t.valor) || 0;
      } else {
        sacadoMap.set(t.cpf_cnpj_sacado, {
          nome: t.sacado || '',
          cpf_cnpj: t.cpf_cnpj_sacado,
          valor: parseFloat(t.valor) || 0,
        });
      }
    }
  });

  const concentracaoSacados = Array.from(sacadoMap.values())
    .map((s) => ({
      cpf_cnpj: s.cpf_cnpj,
      nome: s.nome,
      risco: s.valor,
      concentracao: carteiraTotal > 0 ? (s.valor / carteiraTotal) * 100 : 0,
    }))
    .sort((a, b) => b.risco - a.risco)
    .slice(0, 10);

  const receitaMensalMap = new Map<string, number>();
  receitas.forEach((r: any) => {
    if (r.data_pagamento) {
      const mes = r.data_pagamento.substring(0, 7);
      receitaMensalMap.set(mes, (receitaMensalMap.get(mes) || 0) + (parseFloat(r.total) || 0));
    }
  });

  const receitaMensal = Array.from(receitaMensalMap.entries())
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 12);

  const hoje90Dias = new Date();
  hoje90Dias.setDate(hoje90Dias.getDate() - 90);

  const comp90Pontual = { valor: 0, qtd: 0 };
  const comp90Atraso5 = { valor: 0, qtd: 0 };
  const comp90Atraso15 = { valor: 0, qtd: 0 };
  const comp90Atraso30 = { valor: 0, qtd: 0 };
  const comp90AtrasoMais30 = { valor: 0, qtd: 0 };
  const comp90Total = { valor: 0, qtd: 0 };

  titulosQuitados.forEach((t: any) => {
    const quitacao = t.quitacao ? new Date(t.quitacao) : null;
    if (!quitacao || quitacao < hoje90Dias) return;

    const vencimento = t.vencimento ? new Date(t.vencimento) : null;
    const valorFace = parseFloat(t.valor_face) || 0;

    comp90Total.valor += valorFace;
    comp90Total.qtd++;

    if (vencimento) {
      const diffDays = Math.floor((quitacao.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        comp90Pontual.valor += valorFace;
        comp90Pontual.qtd++;
      } else if (diffDays <= 5) {
        comp90Atraso5.valor += valorFace;
        comp90Atraso5.qtd++;
      } else if (diffDays <= 15) {
        comp90Atraso15.valor += valorFace;
        comp90Atraso15.qtd++;
      } else if (diffDays <= 30) {
        comp90Atraso30.valor += valorFace;
        comp90Atraso30.qtd++;
      } else {
        comp90AtrasoMais30.valor += valorFace;
        comp90AtrasoMais30.qtd++;
      }
    } else {
      comp90Pontual.valor += valorFace;
      comp90Pontual.qtd++;
    }
  });

  const comp90Recompra = { valor: 0, qtd: 0 };
  recomprados.forEach((t: any) => {
    const recompraDate = t.recompra ? new Date(t.recompra) : null;
    if (!recompraDate || recompraDate < hoje90Dias) return;
    comp90Recompra.valor += parseFloat(t.valor_face) || 0;
    comp90Recompra.qtd++;
  });

  return {
    cedente: {
      id: cedente.id_cedente || 0,
      nome: cedente.nome,
      cpf_cnpj: cedente.cpf_cnpj,
      endereco: cedente.endereco,
      cep: cedente.cep,
      cidade: cedente.cidade,
      uf: cedente.uf,
      email: cedente.email,
      telefone: cedente.telefone,
      gerente: cedente.gerente,
      operador: cedente.operador,
      captador: cedente.captador,
      limite_global: parseFloat(cedente.limite_global) || 0,
      risco_atual: parseFloat(cedente.risco_atual) || 0,
      saldo: parseFloat(cedente.saldo) || 0,
      bloqueado: cedente.bloqueado,
      data_cadastro: cedente.data_cadastro,
      setor: cedente.setor,
      grupo_economico: cedente.grupo_economico,
    },
    resumo: {
      primeiraOperacao: cedente.primeira_operacao,
      ultimaOperacao: operacoes[0]?.data || null,
      totalOperacoes,
      valorBrutoTotal,
      valorLiquidoTotal,
      receitaTotal,
      taxaMedia: taxaMediaCalc,
    },
    resumoExpandido: {
      volumeOperado: valorBrutoTotal,
      prazoMedioOperacoes: totalOperacoes > 0 ? prazoMedioTotal / totalOperacoes : 0,
      prazoMedioTitulos90Dias: 0,
      mediaPagoEmAtraso: comp90Total.qtd > 0 ? ((comp90Atraso5.qtd + comp90Atraso15.qtd + comp90Atraso30.qtd + comp90AtrasoMais30.qtd) / comp90Total.qtd) * 100 : 0,
      valorMedioBorderos: totalOperacoes > 0 ? valorBrutoTotal / totalOperacoes : 0,
      valorMedioTitulos: titulosAberto.length > 0 ? carteiraTotal / titulosAberto.length : 0,
      receitaGerada: receitaTotal,
      percentualProrrogacao: 0,
      chqDevolvidosAberto: titulosAberto.filter((t: any) => t.tipo === 'CHQ' && t.situacao === 'Devolvido').length,
      chqDevolvidosQuitado: titulosQuitados.filter((t: any) => t.tipo === 'CHQ' && t.motivo_devolucao).length,
    },
    limites: {
      global: parseFloat(cedente.limite_global) || 0,
      disponivel: parseFloat(cedente.saldo) || 0,
      risco: parseFloat(cedente.risco_atual) || 0,
      saldo: parseFloat(cedente.saldo) || 0,
    },
    confirmacao: {
      confirmado: { qtd: titulosAberto.filter((t: any) => t.conf === 'Confirmado' || t.conf === 'C').length, valor: titulosAberto.filter((t: any) => t.conf === 'Confirmado' || t.conf === 'C').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
      parcial: { qtd: titulosAberto.filter((t: any) => t.conf === 'Parcial' || t.conf === 'P').length, valor: titulosAberto.filter((t: any) => t.conf === 'Parcial' || t.conf === 'P').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
      pendente: { qtd: titulosAberto.filter((t: any) => t.conf === 'Pendente' || t.conf === 'N').length, valor: titulosAberto.filter((t: any) => t.conf === 'Pendente' || t.conf === 'N').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
      semConfirmacao: { qtd: titulosAberto.filter((t: any) => !t.conf || t.conf === '').length, valor: titulosAberto.filter((t: any) => !t.conf || t.conf === '').reduce((a: number, t: any) => a + (parseFloat(t.valor) || 0), 0), percentual: 0 },
      total: { qtd: titulosAberto.length, valor: carteiraTotal },
    },
    carteira: {
      total: carteiraTotal,
      vencidos: carteiraVencida,
      percentualVencido: carteiraTotal > 0 ? (carteiraVencida / carteiraTotal) * 100 : 0,
    },
    concentracaoSacados,
    liquidez: {
      totalQuitados: titulosQuitados.length,
      valorQuitado: valorQuitadoTotal,
      totalRecomprados: recomprados.length,
      valorRecomprado: valorRecompradoTotal,
      percentualPontual,
      percentualAtraso,
      percentualRecompra,
      percentualLiquidado,
    },
    comportamento90Dias: {
      pontual: {
        valor: comp90Pontual.valor,
        qtd: comp90Pontual.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90Pontual.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90Pontual.qtd / comp90Total.qtd) * 100 : 0,
      },
      atraso5: {
        valor: comp90Atraso5.valor,
        qtd: comp90Atraso5.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90Atraso5.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso5.qtd / comp90Total.qtd) * 100 : 0,
      },
      atraso15: {
        valor: comp90Atraso15.valor,
        qtd: comp90Atraso15.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90Atraso15.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso15.qtd / comp90Total.qtd) * 100 : 0,
      },
      atraso30: {
        valor: comp90Atraso30.valor,
        qtd: comp90Atraso30.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90Atraso30.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90Atraso30.qtd / comp90Total.qtd) * 100 : 0,
      },
      atrasoMais30: {
        valor: comp90AtrasoMais30.valor,
        qtd: comp90AtrasoMais30.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90AtrasoMais30.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90AtrasoMais30.qtd / comp90Total.qtd) * 100 : 0,
      },
      recompra: {
        valor: comp90Recompra.valor,
        qtd: comp90Recompra.qtd,
        percentualValor: comp90Total.valor > 0 ? (comp90Recompra.valor / comp90Total.valor) * 100 : 0,
        percentualQtd: comp90Total.qtd > 0 ? (comp90Recompra.qtd / comp90Total.qtd) * 100 : 0,
      },
      repasse: { valor: 0, qtd: 0, percentualValor: 0, percentualQtd: 0 },
      cartorio: { valor: 0, qtd: 0, percentualValor: 0, percentualQtd: 0 },
      totalPago: comp90Total,
      emAtraso: {
        valor: carteiraVencida,
        qtd: titulosVencidos.length,
        percentualValor: carteiraTotal > 0 ? (carteiraVencida / carteiraTotal) * 100 : 0,
        percentualQtd: titulosAberto.length > 0 ? (titulosVencidos.length / titulosAberto.length) * 100 : 0,
      },
    },
    receitaMensal,
    titulosAberto: titulosAberto.slice(0, 50).map((t: any) => ({
      id: t.dev_id || 0,
      documento: t.documento || t.id_titulo,
      sacado: t.sacado,
      cpf_cnpj_sacado: t.cpf_cnpj_sacado,
      valor: parseFloat(t.valor) || 0,
      vencimento: t.vencimento,
      situacao: t.situacao,
      conf: t.conf,
      etapa: t.etapa,
    })),
    titulosQuitados: titulosQuitados.slice(0, 50).map((t: any) => ({
      id: t.dev_id || 0,
      numero: t.numero,
      sacado: t.sacado,
      cpf_cnpj_sacado: t.cpf_cnpj_sacado,
      valor_face: parseFloat(t.valor_face) || 0,
      valor_liquidado: parseFloat(t.valor_liquidado) || 0,
      vencimento: t.vencimento,
      quitacao: t.quitacao,
      status: t.status,
      tipo_quitacao: t.tipo_quitacao,
    })),
    ultimasOperacoes: operacoes.slice(0, 20).map((op: any) => ({
      id: op.dev_id || 0,
      operacao: op.operacao,
      data: op.data,
      valor_bruto: parseFloat(op.valor_bruto) || 0,
      valor_liquido: parseFloat(op.valor_liquido) || 0,
      valor_taxa: (() => {
        const bruto = parseFloat(op.valor_bruto) || 0;
        const liquido = parseFloat(op.valor_liquido) || 0;
        const prazo = parseFloat(op.prazo_medio) || 0;
        if (bruto > 0 && prazo > 0) {
          const desagio = bruto - liquido;
          return (desagio / bruto / prazo) * 30 * 100;
        }
        return 0;
      })(),
      prazo_medio: parseFloat(op.prazo_medio) || 0,
      etapa: op.etapa,
    })),
    suspeitasFraude: suspeitaFraude.map((f: any) => ({
      id: f.dev_id || 0,
      sacado: f.sacado,
      cpf_cnpj_sacado: f.cpf_cnpj_sacado,
      numero_documento: f.numero_documento,
      valor: parseFloat(f.valor) || 0,
      vencimento: f.vencimento,
      data_quitacao: f.data_quitacao,
      criticas: f.criticas,
      banco_cobrador: f.banco_cobrador,
      agencia_cobradora: f.agencia_cobradora,
      praca_pagamento: f.praca_pagamento,
      localidade_sacado: f.localidade_sacado,
    })),
  };
}
